#!/usr/bin/env node
/**
 * Preflight: run before every push.
 *
 *   node preflight/run.mjs            full run (types, tests, requirements, hazards, deploy plan)
 *   node preflight/run.mjs --quick    skip the test run
 *   node preflight/run.mjs --hook     used by the git pre-push hook (same checks, shorter output)
 *
 * It proves what can be proven by code. Items marked MANUAL need the deep review in
 * .claude/skills/preflight/SKILL.md (a person or Claude reads the code and confirms).
 * Exit code 1 means a blocking failure: do not push.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, normalize, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const QUICK = args.has("--quick");
const HOOK = args.has("--hook");

const results = []; // { level: "pass"|"fail"|"warn"|"manual", id, msg }
const add = (level, id, msg) => results.push({ level, id, msg });

const toPosix = (p) => p.split(sep).join("/");
const rel = (p) => toPosix(relative(ROOT, p));

// ---------------------------------------------------------------- file helpers
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", ".expo", "dist", "build", "coverage", "__pycache__"]);

function walk(target, out = []) {
  const abs = resolve(ROOT, target);
  if (!existsSync(abs)) return out;
  const st = statSync(abs);
  if (st.isFile()) {
    out.push(abs);
    return out;
  }
  for (const name of readdirSync(abs)) {
    if (SKIP_DIRS.has(name)) continue;
    walk(join(abs, name), out);
  }
  return out;
}

const TEXT_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|py|md|css|yml|yaml|sh)$/i;
const read = (abs) => {
  try {
    return readFileSync(abs, "utf8");
  } catch {
    return "";
  }
};

function filesFor(paths, exclude = []) {
  const ex = exclude.map((e) => new RegExp(e));
  const all = [];
  for (const p of paths) walk(p, all);
  return all.filter((f) => TEXT_EXT.test(f) && !ex.some((r) => r.test(toPosix(f))));
}

function findMatches(files, pattern, flags = "") {
  const re = new RegExp(pattern, flags);
  const hits = [];
  for (const f of files) {
    const lines = read(f).split(/\r?\n/);
    lines.forEach((line, i) => {
      if (re.test(line)) hits.push(`${rel(f)}:${i + 1}`);
    });
  }
  return hits;
}

function run(cmd, cmdArgs, opts = {}) {
  const isWin = process.platform === "win32";
  return spawnSync(cmd, cmdArgs, {
    cwd: ROOT,
    encoding: "utf8",
    shell: isWin && /^(npx|npm)$/.test(cmd),
    maxBuffer: 64 * 1024 * 1024,
    ...opts,
  });
}

// ---------------------------------------------------------------- 1. type check
function typeCheck() {
  const tsc = join(ROOT, "node_modules", "typescript", "bin", "tsc");
  if (!existsSync(tsc)) {
    add("warn", "TYPES", "typescript not installed locally; skipped (run npm ci)");
    return;
  }
  const r = run(process.execPath, [tsc, "--noEmit", "-p", "tsconfig.json"]);
  const errs = (r.stdout + r.stderr)
    .split(/\r?\n/)
    .filter((l) => /^(app|components|src)\//.test(l) && !/\.test\.ts/.test(l));
  if (errs.length === 0) add("pass", "TYPES", "TypeScript clean (same check the Docker build runs)");
  else add("fail", "TYPES", `${errs.length} type error(s):\n      ${errs.slice(0, 12).join("\n      ")}`);
}

// ---------------------------------------------------------------- 2. tests
let failedTestFiles = new Set();
let testsRan = false;

function runTests() {
  if (QUICK) {
    add("warn", "TESTS", "skipped (--quick)");
    return;
  }
  const knownPath = join(ROOT, "preflight", "known-failures.json");
  const known = existsSync(knownPath) ? JSON.parse(read(knownPath)).files ?? [] : [];
  const outFile = join(ROOT, "preflight", ".test-results.json");
  const r = run("npx", ["--yes", "vitest@5", "run", "--config", "preflight/vitest.config.mjs", "--reporter=json", `--outputFile=${outFile}`]);
  const out = r.stdout ?? "";
  let json = null;
  try {
    json = JSON.parse(read(outFile));
  } catch {
    try {
      json = JSON.parse(out.slice(out.indexOf("{")));
    } catch {
      /* handled below */
    }
  }
  if (!json) {
    add("fail", "TESTS", "could not read the test results:\n      " + (r.stderr || out).split(/\r?\n/).slice(-8).join("\n      "));
    return;
  }
  testsRan = true;
  const failed = (json.testResults ?? []).filter((t) => t.status === "failed");
  failedTestFiles = new Set(failed.map((t) => rel(t.name)));
  const unexpected = [...failedTestFiles].filter((f) => !known.includes(f));
  const nowPassing = known.filter((f) => !failedTestFiles.has(f));
  const total = json.numTotalTests ?? 0;
  const passed = json.numPassedTests ?? 0;
  if (unexpected.length === 0) {
    add("pass", "TESTS", `${passed}/${total} tests pass (${known.length} known pre-existing failing file(s) tolerated)`);
  } else {
    const names = [];
    for (const t of failed) {
      if (!unexpected.includes(rel(t.name))) continue;
      for (const a of t.assertionResults ?? []) if (a.status === "failed") names.push(`${rel(t.name)} > ${a.fullName}`);
      if (!(t.assertionResults ?? []).some((a) => a.status === "failed")) names.push(`${rel(t.name)} (failed to load)`);
    }
    add("fail", "TESTS", `NEW failing test(s):\n      ${names.slice(0, 10).join("\n      ")}`);
  }
  if (nowPassing.length) add("warn", "TESTS", `these known-failing files now pass; remove from preflight/known-failures.json: ${nowPassing.join(", ")}`);
}

// ---------------------------------------------------------------- 3. worker import graph
const WORKER_ENTRY = join(ROOT, "apps", "ml-worker", "src", "worker.ts");
const IMPORT_RE = /(?:import|export)\s[^;]*?from\s+["']([^"']+)["']|import\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/gs;
let workerGraph = new Map(); // file -> parent

function resolveImport(spec, from) {
  let base;
  if (spec.startsWith("@/")) base = join(ROOT, spec.slice(2));
  else if (spec.startsWith(".")) base = normalize(join(dirname(from), spec));
  else return null;
  if (base.endsWith(".js")) base = base.slice(0, -3);
  for (const ext of [".ts", ".tsx", "/index.ts", ".js", ""]) {
    const p = base + ext;
    if (existsSync(p) && statSync(p).isFile()) return p;
  }
  return null;
}

function buildWorkerGraph() {
  const parent = new Map([[WORKER_ENTRY, null]]);
  if (!existsSync(WORKER_ENTRY)) return parent;
  const queue = [WORKER_ENTRY];
  while (queue.length) {
    const f = queue.shift();
    const src = read(f);
    for (const m of src.matchAll(IMPORT_RE)) {
      const spec = m[1] ?? m[2] ?? m[3];
      const p = spec ? resolveImport(spec, f) : null;
      if (p && !parent.has(p)) {
        parent.set(p, f);
        queue.push(p);
      }
    }
  }
  return parent;
}

function checkWorkerGraph() {
  workerGraph = buildWorkerGraph();
  const bad = [];
  for (const f of workerGraph.keys()) {
    if (/import\s+["']server-only["']/.test(read(f))) {
      const chain = [];
      for (let x = f; x; x = workerGraph.get(x)) chain.push(rel(x));
      bad.push(chain.join("  <-  "));
    }
  }
  return bad;
}

// ---------------------------------------------------------------- 4. requirement checks
const EMOJI_RE = /\p{Emoji_Presentation}/u;

function evalCheck(req, check) {
  const sev = req.severity === "warn" ? "warn" : "fail";
  const id = req.id;
  switch (check.type) {
    case "present": {
      const abs = join(ROOT, check.file);
      if (!existsSync(abs)) return [sev, `missing file ${check.file}`];
      return new RegExp(check.pattern).test(read(abs)) ? ["pass"] : [sev, `${check.file} no longer contains /${check.pattern}/`];
    }
    case "max-count": {
      const abs = join(ROOT, check.file);
      const n = (read(abs).match(new RegExp(check.pattern, "g")) ?? []).length;
      return n <= check.max ? ["pass"] : [sev, `${check.file} has ${n} copies of /${check.pattern}/ (max ${check.max}); duplicated block`];
    }
    case "min-count": {
      let n = 0;
      for (const f of check.files) n += (read(join(ROOT, f)).match(new RegExp(check.pattern, "g")) ?? []).length;
      return n >= check.min ? ["pass"] : [sev, `only ${n} match(es) of /${check.pattern}/, need ${check.min}`];
    }
    case "absent": {
      const hits = findMatches(filesFor(check.paths, check.exclude ?? []), check.pattern, check.ignoreCase ? "i" : "");
      return hits.length === 0 ? ["pass"] : [sev, `forbidden /${check.pattern}/ found at ${hits.slice(0, 5).join(", ")}${hits.length > 5 ? ` (+${hits.length - 5} more)` : ""}`];
    }
    case "file-exists":
      return existsSync(join(ROOT, check.file)) ? ["pass"] : [sev, `missing ${check.file}`];
    case "test": {
      if (!existsSync(join(ROOT, check.file))) return [sev, `missing test file ${check.file}`];
      if (testsRan && failedTestFiles.has(check.file)) return [sev, `test file ${check.file} is failing`];
      return ["pass"];
    }
    case "no-emoji": {
      const hits = [];
      for (const f of filesFor(check.paths, ["\\.test\\."])) {
        read(f).split(/\r?\n/).forEach((line, i) => {
          if (EMOJI_RE.test(line)) hits.push(`${rel(f)}:${i + 1}`);
        });
      }
      return hits.length === 0 ? ["pass"] : [sev, `emoji in patient UI at ${hits.slice(0, 6).join(", ")}`];
    }
    case "worker-graph-safe": {
      const bad = checkWorkerGraph();
      return bad.length === 0 ? ["pass"] : [sev, `worker would crash at start-up, web-only import reachable:\n        ${bad.join("\n        ")}`];
    }
    case "manual":
      return ["manual", check.how];
    default:
      return ["warn", `unknown check type ${check.type}`];
  }
}

function requirementChecks() {
  const reg = JSON.parse(read(join(ROOT, "preflight", "requirements.json")));
  for (const req of reg.requirements) {
    let failed = false;
    for (const c of req.checks) {
      const [level, msg] = evalCheck(req, c);
      if (level === "manual") add("manual", req.id, msg);
      else if (level !== "pass") {
        failed = true;
        add(level, req.id, `${req.title}\n      -> ${msg}`);
      }
    }
    if (!failed) add("pass", req.id, req.title);
  }
}

// ---------------------------------------------------------------- 5. hazard scans (things not tied to one request)
function hazardScans() {
  // 5a. every place a scan row is created must stamp it, or the score ceiling silently differs.
  for (const f of filesFor(["app", "src"], ["\\.test\\.", "seed", "src/scripts/"])) {
    const s = read(f);
    if (/\.insert\(scans\)/.test(s) && !/stampScanOrdinal/.test(s)) {
      add("fail", "HAZARD", `${rel(f)} creates scans without stampScanOrdinal(); that scan would use the wrong score ceiling`);
    }
  }
  // 5b. AI text paths: any place that calls the model directly for patient text should use runVerified.
  const aiFiles = filesFor(["src/lib", "app/api"], ["\\.test\\.", "aiVerified"]).filter((f) => /chat\.completions\.create/.test(read(f)));
  const verified = new Set(filesFor(["src/lib", "app/api"], ["\\.test\\."]).filter((f) => /runVerified/.test(read(f))).map(rel));
  const unverified = aiFiles.map(rel).filter((f) => !verified.has(f));
  if (unverified.length) {
    add("warn", "AI-COVERAGE", `these files call the AI for text but do not use the three-layer check (confirm each is intended):\n      ${unverified.join("\n      ")}`);
  }
  // 5c. environment variables used in code but not documented.
  const envExample = read(join(ROOT, ".env.example"));
  const used = new Set();
  for (const f of filesFor(["src", "app", "apps"], ["\\.test\\."])) {
    for (const m of read(f).matchAll(/process\.env\.([A-Z][A-Z0-9_]+)/g)) used.add(m[1]);
  }
  const ignore = /^(NODE_ENV|NEXT_|VERCEL|CI$|PORT$|HOME$|PATH$|TZ$)/;
  const undocumented = [...used].filter((v) => !ignore.test(v) && !envExample.includes(v));
  if (undocumented.length > 12) {
    add("warn", "ENV", `${undocumented.length} environment variables used in code are not in .env.example (first: ${undocumented.slice(0, 8).join(", ")})`);
  }
  // 5d. a database schema change needs a hand-run migration: they are NOT automated on deploy.
  const changed = changedFiles();
  if (changed.some((f) => f === "src/db/schema.ts" || f.startsWith("drizzle/"))) {
    add("warn", "DB", "database schema changed: migrations are NOT automated on deploy. Prepare the SQL and run it by hand before restarting web and ml-worker.");
  }
}

// ---------------------------------------------------------------- 6. deploy plan
function git(...a) {
  const r = run("git", a);
  return r.status === 0 ? r.stdout : "";
}

let _changed = null;
function changedFiles() {
  if (_changed) return _changed;
  const set = new Set();
  const base = git("rev-parse", "--verify", "-q", "origin/main").trim() ? "origin/main" : null;
  if (base) git("diff", "--name-only", `${base}...HEAD`).split(/\r?\n/).filter(Boolean).forEach((f) => set.add(f));
  git("status", "--porcelain")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("??"))
    .forEach((l) => set.add(l.slice(3).replace(/^"|"$/g, "")));
  _changed = [...set];
  return _changed;
}

function deployPlan() {
  const changed = changedFiles().filter(
    (f) => !f.startsWith("preflight/") && !f.startsWith(".claude/") && !f.startsWith("mobile/") && !f.startsWith(".githooks/") && !/\.(pyc|jpg|png)$|__pycache__/.test(f)
  );
  if (changed.length === 0) return null;
  const graph = new Set([...workerGraph.keys()].map(rel));
  const containers = new Set();
  const why = {};
  const mark = (c, f) => {
    containers.add(c);
    (why[c] ??= []).push(f);
  };
  for (const f of changed) {
    if (f.startsWith("services/spot-detector")) mark("spot-detector", f);
    else if (f.startsWith("services/acne-detector")) mark("acne-detector", f);
    else if (f.startsWith("services/ml-inference")) mark("ml-inference", f);
    if (graph.has(f) || f.startsWith("apps/ml-worker/")) mark("ml-worker", f);
    if (/^(app|components|src|public)\//.test(f) || f === "middleware.ts" || f === "package.json") mark("web", f);
  }
  if (containers.size === 0) return { containers: [], why, changed };
  return { containers: [...containers], why, changed };
}

// ---------------------------------------------------------------- run everything
console.log("\nPREFLIGHT  (do not push on any [FAIL])\n");
typeCheck();
runTests();
buildWorkerGraph(); // fills workerGraph for the deploy plan even if the registry entry is absent
workerGraph = buildWorkerGraph();
requirementChecks();
hazardScans();
const plan = deployPlan();

const order = { fail: 0, warn: 1, manual: 2, pass: 3 };
const tag = { fail: "[FAIL]  ", warn: "[WARN]  ", manual: "[MANUAL]", pass: "[PASS]  " };
const sorted = [...results].sort((a, b) => order[a.level] - order[b.level]);
for (const r of sorted) {
  if (HOOK && r.level === "pass") continue;
  console.log(`${tag[r.level]} ${r.id.padEnd(22)} ${r.msg}`);
}

const count = (lvl) => results.filter((r) => r.level === lvl).length;
console.log(`\n${count("pass")} passed, ${count("fail")} failed, ${count("warn")} warnings, ${count("manual")} need a human/AI review.`);

if (plan) {
  console.log("\nDEPLOY PLAN (what must be rebuilt on the server after this push)");
  if (plan.containers.length === 0) console.log("  nothing to rebuild");
  for (const c of plan.containers) {
    const why = plan.why[c];
    console.log(`  - ${c}   (${why.length} changed file(s), e.g. ${why.slice(0, 2).join(", ")})`);
  }
  if (plan.containers.length) {
    console.log("\n  cd /opt/skinfit && sudo git pull");
    console.log(`  cd /opt/skinfit/docker && sudo docker compose build ${plan.containers.join(" ")} && sudo docker compose up -d ${plan.containers.join(" ")}`);
  }
  if (plan.changed.includes("src/lib/scanOrdinal.ts")) console.log("  remember: older scans need the one-time stamp SQL (see SCORE-STAMP) if not yet run.");
}

if (count("fail") > 0) {
  console.log("\nBLOCKED: fix the failures above, then run again.\n");
  process.exit(1);
}
if (count("manual") > 0 && !HOOK) {
  console.log("\nAutomated checks pass. Items marked MANUAL still need the deep review (run /preflight in Claude Code).\n");
}
process.exit(0);
