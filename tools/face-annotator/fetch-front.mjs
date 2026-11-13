// Downloads ONE front white-light photo + the numbers for each Medixora report link.
//
//   node fetch-front.mjs links-short.txt
//
// The file has one report link per line (full links, or share.google short links). Nothing else is downloaded.
// Output (in DATA_DIR, or ./data next to this file; never committed to git):
//   data/images/<id>.jpg   front white-light photo
//   data/labels/<id>.json  scores and counts only (no name, phone, avatar, device or link)
//   data/index.csv         id, status
// <id> is an anonymous hash of the report number. Links and tokens are never printed or saved.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const linksFile = process.argv[2];
if (!linksFile) {
  console.error("Usage: node fetch-front.mjs links.txt");
  process.exit(1);
}
const API = "https://a3ff-api.bitmoji-zm.com/api/h5/getreportdata";
const out = process.env.DATA_DIR || path.join(here, "data");
fs.mkdirSync(path.join(out, "images"), { recursive: true });
fs.mkdirSync(path.join(out, "labels"), { recursive: true });
const indexPath = path.join(out, "index.csv");
if (!fs.existsSync(indexPath)) fs.writeFileSync(indexPath, "id,status\n");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const lines = fs
  .readFileSync(linksFile, "utf8")
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter(Boolean);

// Google short links (share.google/...) redirect to the real report link; follow them by hand so the
// "#/report?report_sn=...&token=..." part is kept.
async function resolve(link) {
  if (!/^https?:\/\/share\.google\//.test(link)) return link;
  let url = link;
  for (let hop = 0; hop < 6; hop++) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      const loc = res.headers.get("location");
      if (!loc) return url;
      url = new URL(loc, url).toString();
      if (/report_sn=/.test(url) && /token=/.test(url)) return url;
    } catch {
      return url;
    }
  }
  return url;
}

function parse(link) {
  const hash = link.split("#")[1] ?? "";
  const q = new URLSearchParams(hash.split("?")[1] ?? "");
  const sn = q.get("report_sn");
  const token = q.get("token");
  return sn && token ? { sn, token } : null;
}

async function getJson({ sn, token }) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token, report_sn: sn }).toString(),
      });
      const j = await res.json();
      if (j?.success && j?.data?.data) return { ok: true, d: j.data.data };
      return { ok: false, why: String(j?.message ?? "no data") };
    } catch (e) {
      if (attempt === 3) return { ok: false, why: "network error" };
      await sleep(1500 * attempt);
    }
  }
  return { ok: false, why: "failed" };
}

const slim = (r) => ({
  name: r.Name, type: r.Type, face: r.FaceTypeName, level: Number(r.Level), score: Number(r.Score),
  count: Number(r.Count), area: r.Area, rate: r.Rate,
});

let done = 0, skipped = 0, failed = 0;
for (const [i, link] of lines.entries()) {
  const p = parse(await resolve(link));
  if (!p) {
    console.log(`#${i + 1}: not a valid report link`);
    failed++;
    continue;
  }
  const id = crypto.createHash("sha256").update(p.sn).digest("hex").slice(0, 12);
  const imgPath = path.join(out, "images", `${id}.jpg`);
  if (fs.existsSync(imgPath)) {
    skipped++;
    continue;
  }
  const r = await getJson(p);
  if (!r.ok) {
    console.log(`#${i + 1}: ${r.why}`);
    fs.appendFileSync(indexPath, `${id},failed: ${r.why}\n`);
    failed++;
    await sleep(700);
    continue;
  }
  const d = r.d;
  // Camera angles in a Medixora report: FaceType 1 = left side, 2 = FRONT, 3 = right side. LightType 1 = white light.
  const front = (d.CollectImage ?? []).find((c) => String(c.FaceType) === "2" && String(c.LightType) === "1");
  if (!front?.Pic) {
    console.log(`#${i + 1}: no front photo in this report`);
    fs.appendFileSync(indexPath, `${id},failed: no front photo\n`);
    failed++;
    continue;
  }
  let img = null;
  for (let attempt = 1; attempt <= 4 && !img?.ok; attempt++) {
    try {
      img = await fetch(front.Pic);
    } catch {
      img = null;
      await sleep(1500 * attempt);
    }
  }
  if (!img?.ok) {
    console.log(`#${i + 1}: photo download failed (${img.status})`);
    fs.appendFileSync(indexPath, `${id},failed: photo ${img.status}\n`);
    failed++;
    continue;
  }
  let bytes;
  try {
    bytes = Buffer.from(await img.arrayBuffer());
  } catch {
    console.log(`#${i + 1}: photo download interrupted`);
    failed++;
    continue;
  }
  fs.writeFileSync(imgPath, bytes);
  const labels = {
    id,
    sex: d.Customer?.Sex ?? null,
    age: d.Customer?.Age ?? null,
    predicted_age: d.PredictedAge ?? null,
    skin_type: d.SkinType ?? null,
    comprehensive_score: Number(d.Score),
    level: d.LevelName ?? null,
    scanned_at: d.DeviceCreateTime ?? d.ServerCreateTime ?? null,
    skin_colour_ita: d.FaceSkinColor?.ITA ?? null,
    results: (d.ResultDetail ?? []).map(slim),
    regions: (d.RegionResult ?? []).map((x) => ({ region: x.Region, type: x.Type, face: x.FaceType, count: Number(x.Count), area: x.Area, ratio: x.Ratio })),
  };
  fs.writeFileSync(path.join(out, "labels", `${id}.json`), JSON.stringify(labels, null, 1));
  fs.appendFileSync(indexPath, `${id},ok\n`);
  done++;
  console.log(`#${i + 1}: saved ${id} (${(fs.statSync(imgPath).size / 1024).toFixed(0)} KB)`);
  await sleep(700);
}
console.log(`\nDone. Saved ${done}, already had ${skipped}, failed ${failed}. Folder: ${out}`);
