/**
 * Simulate N concurrent annotators against the live API.
 *
 * Run on EC2 (uses real DB users + session secret from web container):
 *   cd /opt/skinfit
 *   docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml exec -T web \
 *     npx tsx scripts/annotator-load-test.ts --users 6 --duration 120
 *
 * Or from laptop (needs BASE_URL reachable):
 *   BASE_URL=https://my.skinfitwellness.in npx tsx scripts/annotator-load-test.ts --users 6
 */
import { createSessionToken } from "../src/lib/auth/session";

type UserRow = { id: string; email: string; name: string; role: string };

type Stats = {
  ok: number;
  cache: number;
  lock409: number;
  rate429: number;
  err4xx: number;
  err5xx: number;
  latencies: number[];
  errors: string[];
};

function parseArgs() {
  const args = process.argv.slice(2);
  let users = 6;
  let durationSec = 90;
  let writes = true;
  let baseUrl = process.env.BASE_URL?.trim() || "http://127.0.0.1";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--users" && args[i + 1]) users = Number.parseInt(args[++i], 10);
    else if (args[i] === "--duration" && args[i + 1]) durationSec = Number.parseInt(args[++i], 10);
    else if (args[i] === "--base" && args[i + 1]) baseUrl = args[++i];
    else if (args[i] === "--read-only") writes = false;
    else if (args[i] === "--writes") writes = true;
  }
  return { users, durationSec, baseUrl: baseUrl.replace(/\/$/, ""), writes };
}

function emptyStats(): Stats {
  return { ok: 0, cache: 0, lock409: 0, rate429: 0, err4xx: 0, err5xx: 0, latencies: [], errors: [] };
}

function record(stats: Stats, status: number, ms: number, detail?: string) {
  stats.latencies.push(ms);
  if (status === 200 || status === 201 || status === 204) stats.ok++;
  else if (status === 304) stats.cache++;
  else if (status === 409) stats.lock409++;
  else if (status === 429) stats.rate429++;
  else if (status >= 500) {
    stats.err5xx++;
    if (detail) stats.errors.push(detail);
  } else if (status >= 400) {
    stats.err4xx++;
    if (detail) stats.errors.push(detail);
  }
}

async function api(
  stats: Stats,
  baseUrl: string,
  token: string,
  method: string,
  path: string,
  body?: unknown
) {
  const t0 = performance.now();
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const ms = performance.now() - t0;
    const detail = res.ok ? undefined : `${method} ${path} → ${res.status}`;
    record(stats, res.status, ms, detail);
    return { res, ms };
  } catch (e) {
    const ms = performance.now() - t0;
    record(stats, 599, ms, `${method} ${path} → ${e instanceof Error ? e.message : String(e)}`);
    return { res: null, ms };
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function pct(sorted: number[], p: number) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return Math.round(sorted[idx]!);
}

async function loadDbUsers(): Promise<UserRow[]> {
  const url =
    process.env.DATABASE_URL?.trim() || process.env.LOCAL_POSTGRES_URL?.trim();
  if (!url) throw new Error("DATABASE_URL not set");
  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: url });
  await client.connect();

  const shapeUsers = await client.query<{ user_id: string }>(`
    SELECT DISTINCT u.key AS user_id
    FROM annotator_state s,
         jsonb_each(s.per_user_shapes) AS u(key, shapes)
    WHERE s.scope = 'default'
      AND jsonb_array_length(u.shapes) > 0
  `);

  const ids = shapeUsers.rows.map((r) => r.user_id).filter(Boolean);
  if (!ids.length) {
    await client.end();
    throw new Error("No annotator users found in per_user_shapes");
  }

  const rows = await client.query<UserRow>(
    `SELECT id, email, name, role FROM users WHERE id::text = ANY($1::text[]) LIMIT 20`,
    [ids]
  );
  await client.end();
  return rows.rows;
}

async function simulateAnnotator(
  user: UserRow,
  token: string,
  baseUrl: string,
  durationSec: number,
  imageCount: number,
  stats: Stats,
  opts: { runId: string; writes: boolean; sampleFileUrl: string | null }
) {
  const end = Date.now() + durationSec * 1000;
  let imageIndex = Math.floor(Math.random() * Math.max(1, imageCount));
  let lastHeartbeat = 0;
  let lastSync = 0;
  let lastSwitch = Date.now();
  let saveCounter = 0;
  const shapePrefix = `loadtest-${opts.runId}-${user.id.slice(0, 8)}`;

  await api(stats, baseUrl, token, "GET", "/api/annotator/state?hydrate=1");
  await api(stats, baseUrl, token, "GET", "/api/annotator/images");
  await api(stats, baseUrl, token, "POST", "/api/annotator/locks", {
    imageIndex,
    action: "acquire",
  });

  while (Date.now() < end) {
    const now = Date.now();

    if (now - lastHeartbeat >= 10_000) {
      await api(stats, baseUrl, token, "POST", "/api/annotator/locks", {
        imageIndex,
        action: "heartbeat",
      });
      lastHeartbeat = now;
    }

    if (now - lastSync >= 15_000) {
      await api(stats, baseUrl, token, "GET", "/api/annotator/state?sync=1");
      lastSync = now;
    }

    if (now - lastSwitch >= 25_000) {
      await api(stats, baseUrl, token, "DELETE", `/api/annotator/locks?imageIndex=${imageIndex}`);
      imageIndex = Math.floor(Math.random() * Math.max(1, imageCount));
      await api(stats, baseUrl, token, "POST", "/api/annotator/locks", {
        imageIndex,
        action: "acquire",
      });
      await api(
        stats,
        baseUrl,
        token,
        "GET",
        `/api/annotator/state?imageIndex=${imageIndex}`
      );
      await api(
        stats,
        baseUrl,
        token,
        "GET",
        `/api/annotator/state?peers=1&imageIndex=${imageIndex}`
      );
      if (opts.sampleFileUrl) {
        const enc = opts.sampleFileUrl.split("/").map(encodeURIComponent).join("/");
        await api(stats, baseUrl, token, "GET", `/api/annotator/files/${enc}?w=200`);
        await api(stats, baseUrl, token, "GET", `/api/annotator/files/${enc}`);
      }
      lastSwitch = now;
    }

    if (opts.writes && saveCounter % 3 === 0) {
      await api(stats, baseUrl, token, "PUT", "/api/annotator/state", {
        perImageByCategory: {
          [String(imageIndex)]: {
            "Active Acne": { spec: "", grade: "B" },
          },
        },
        annotations: [
          {
            id: `${shapePrefix}-${saveCounter}`,
            imageIndex,
            category: "Active Acne",
            spec: "",
            severity: "B",
            color: "rgb(239, 68, 68)",
            type: "path",
            points: [
              { x: 0.2, y: 0.2 },
              { x: 0.4, y: 0.2 },
              { x: 0.3, y: 0.4 },
            ],
          },
        ],
      });
    }
    saveCounter++;

    await sleep(2000 + Math.floor(Math.random() * 1500));
  }

  await api(stats, baseUrl, token, "DELETE", `/api/annotator/locks?imageIndex=${imageIndex}`);

  if (opts.writes) {
    const { res } = await api(stats, baseUrl, token, "GET", "/api/annotator/state");
    if (res?.ok) {
      const json = (await res.json()) as { state?: { annotations?: { id: string }[] } };
      const kept = (json.state?.annotations ?? []).filter(
        (a) => !String(a.id).startsWith(shapePrefix)
      );
      await api(stats, baseUrl, token, "PUT", "/api/annotator/state", {
        annotations: kept,
        allowEmptyAnnotations: true,
      });
    }
  }
}

function mergeStats(all: Stats[]): Stats {
  const out = emptyStats();
  for (const s of all) {
    out.ok += s.ok;
    out.cache += s.cache;
    out.lock409 += s.lock409;
    out.rate429 += s.rate429;
    out.err4xx += s.err4xx;
    out.err5xx += s.err5xx;
    out.latencies.push(...s.latencies);
    out.errors.push(...s.errors);
  }
  return out;
}

function printReport(label: string, stats: Stats, users: number, durationSec: number) {
  const lat = [...stats.latencies].sort((a, b) => a - b);
  const total = stats.latencies.length;
  console.log(`\n═══ ${label} ═══`);
  console.log(`Virtual annotators: ${users}  Duration: ${durationSec}s  Requests: ${total}`);
  console.log(
    `Status: ok=${stats.ok} cache=${stats.cache} lock409=${stats.lock409} rate429=${stats.rate429} 4xx=${stats.err4xx} 5xx=${stats.err5xx}`
  );
  if (lat.length) {
    console.log(
      `Latency ms: p50=${pct(lat, 50)} p95=${pct(lat, 95)} p99=${pct(lat, 99)} max=${Math.round(lat[lat.length - 1]!)}`
    );
  }
  if (stats.errors.length) {
    console.log("Sample errors:");
    for (const e of stats.errors.slice(0, 8)) console.log(`  - ${e}`);
  }
  const pass =
    stats.err5xx === 0 && stats.rate429 < total * 0.05 && stats.err4xx < total * 0.02;
  console.log(pass ? "\n✅ PASS — looks safe for multi-user load" : "\n⚠️  REVIEW — errors or rate limits detected");
}

async function main() {
  const { users, durationSec, baseUrl, writes } = parseArgs();
  const runId = Date.now().toString(36);
  const secret =
    process.env.AUTH_SECRET?.trim() ||
    process.env.SESSION_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim();
  if (!secret) throw new Error("AUTH_SECRET / SESSION_SECRET not set");

  console.log(`Base URL: ${baseUrl}`);
  console.log(`Loading annotator users from DB…`);

  const dbUsers = await loadDbUsers();
  if (dbUsers.length < users) {
    console.warn(`Only ${dbUsers.length} real annotators in DB; simulating ${dbUsers.length} users`);
  }
  const picked = dbUsers.slice(0, users);
  if (!picked.length) throw new Error("No users to simulate");

  const tokens = await Promise.all(
    picked.map((u) =>
      createSessionToken(
        { id: u.id, email: u.email, role: u.role || "patient", name: u.name || "Load Test" },
        secret
      )
    )
  );

  let imageCount = 526;
  let sampleFileUrl: string | null = null;
  try {
    const probe = await fetch(`${baseUrl}/api/annotator/images`, {
      headers: { Authorization: `Bearer ${tokens[0]}` },
    });
    if (probe.ok) {
      const json = (await probe.json()) as {
        images?: Array<{ fileUrl?: string | null }>;
      };
      imageCount = json.images?.length ?? imageCount;
      sampleFileUrl = json.images?.find((i) => i.fileUrl)?.fileUrl ?? null;
    }
  } catch {
    /* use default */
  }

  console.log(
    `Starting ${picked.length} virtual annotators for ${durationSec}s (${imageCount} images, writes=${writes})…\n`
  );

  const hostBefore = await fetch(`${baseUrl}/healthz`).catch(() => null);

  const started = Date.now();
  const perUser = await Promise.all(
    picked.map(async (user, i) => {
      const stats = emptyStats();
      await simulateAnnotator(user, tokens[i]!, baseUrl, durationSec, imageCount, stats, {
        runId,
        writes,
        sampleFileUrl,
      });
      return stats;
    })
  );
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  const merged = mergeStats(perUser);
  printReport(`Load test complete (${elapsed}s wall)`, merged, picked.length, durationSec);

  if (hostBefore) {
    const hostAfter = await fetch(`${baseUrl}/healthz`).catch(() => null);
    console.log(`Health: ${hostBefore.ok ? "ok" : "?"} → ${hostAfter?.ok ? "ok" : "DOWN"}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
