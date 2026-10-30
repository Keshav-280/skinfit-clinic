// Collects dermatology knowledge from sources whose licence allows commercial reuse, for kAI's RAG index.
//
// Source: Europe PMC open-access full text, ONLY articles licensed "cc by" or "cc0".
// (Non-commercial / no-derivatives / share-alike licences are rejected on purpose.)
//
// Usage:  node src/scripts/rag-fetch-open-sources.mjs [--per-topic 8] [--topics acne,melasma] [--out path]
// Output: src/data/rag/open_sources_chunks.json   (chunks the existing retriever can load)
//         src/data/rag/open_sources_manifest.json (one row per article: id, title, licence, url, for audits and takedowns)
//
// Load it in the app with:  RAG_CHUNK_JSON_PATHS=src/data/rag/open_sources_chunks.json[,src/data/rag/clinic_chunks.json]

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const args = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};

const PER_TOPIC = parseInt(arg("per-topic", "8"), 10);
const OUT = arg("out", join("src", "data", "rag", "open_sources_chunks.json"));
const MANIFEST = join(dirname(OUT), "open_sources_manifest.json");
const ALLOWED = new Set(["cc by", "cc0"]);
const MAX_CHUNKS_PER_ARTICLE = 24;
const CHUNK_CHARS = 1400;
const BASE = "https://www.ebi.ac.uk/europepmc/webservices/rest";

// [required terms in title/abstract, tags that help the retriever]
const TOPICS = [
  ["acne", ["acne"]],
  ["acne AND (retinoid OR \"benzoyl peroxide\" OR topical)", ["acne", "retinoid", "topical"]],
  ["acne AND scar*", ["acne scar", "scars"]],
  ["scar* AND (microneedling OR laser OR resurfacing)", ["scars", "microneedling", "laser"]],
  ["melasma", ["melasma", "pigmentation"]],
  ["(post-inflammatory OR postinflammatory) AND hyperpigmentation", ["pigmentation"]],
  ["hyperpigmentation AND (\"skin of color\" OR \"skin of colour\" OR Indian OR Asian)", ["pigmentation", "skin of colour"]],
  ["tranexamic AND (melasma OR pigmentation)", ["tranexamic acid", "melasma"]],
  ["photoaging OR (skin AND wrinkle*)", ["wrinkles", "photoaging", "ageing"]],
  ["retinoid* AND (aging OR ageing OR photoaging)", ["retinoid", "wrinkles"]],
  ["sunscreen OR photoprotection", ["sunscreen", "sun protection"]],
  ["\"vitamin C\" AND (skin OR topical)", ["vitamin c", "antioxidant"]],
  ["niacinamide", ["niacinamide"]],
  ["\"skin barrier\" AND (moisturizer* OR emollient*)", ["skin barrier", "moisturizer"]],
  ["\"chemical peel\" OR \"chemical peels\" OR \"glycolic acid peel\" OR \"salicylic acid peel\" OR \"peeling agents\"", ["chemical peel"]],
  ["fractional AND laser AND skin", ["laser"]],
  ["microneedling", ["microneedling"]],
  ["\"platelet-rich plasma\" AND (skin OR hair OR facial)", ["prp"]],
  ["\"botulinum toxin\" AND (facial OR wrinkle* OR aesthetic)", ["botulinum toxin", "wrinkles"]],
  ["\"dermal filler*\" OR \"hyaluronic acid filler*\"", ["fillers", "volume"]],
  ["\"dark circles\" OR \"periorbital hyperpigmentation\" OR \"infraorbital\" OR \"tear trough\" OR \"periocular\"", ["under-eye", "dark circles"]],
  ["\"skin laxity\" OR \"facial sagging\" OR \"skin tightening\"", ["sagging", "skin laxity"]],
  ["\"androgenetic alopecia\"", ["hair loss", "alopecia"]],
  ["\"telogen effluvium\" OR \"hair shedding\"", ["hair loss", "shedding"]],
  ["rosacea", ["rosacea"]],
  ["\"seborrheic dermatitis\" OR dandruff", ["scalp", "seborrheic dermatitis"]],
  ["\"atopic dermatitis\" AND (emollient* OR moisturi*)", ["eczema", "atopic dermatitis"]],
  ["acne AND (diet OR \"glycemic\" OR dairy)", ["acne", "diet"]],
  ["skin AND (sleep OR stress) AND (barrier OR acne OR aging OR ageing)", ["sleep", "stress", "skin"]],
  ["isotretinoin", ["isotretinoin", "acne"]],
  ["acne AND (hormonal OR \"polycystic\" OR women)", ["acne", "hormonal"]],
  ["collagen AND (supplement* OR peptide*) AND skin", ["collagen", "nutrition", "ageing"]],
  ["\"artificial intelligence\" AND (dermatology OR \"skin analysis\")", ["ai", "dermatology"]],
  ["\"skin of color\" OR \"skin of colour\"", ["skin of colour"]],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": "SkinFit-RAG-collector (contact: info@skinfitwellness.in)" } });
      if (res.ok) return await res.json();
    } catch {
      /* retry */
    }
    await sleep(800 * (attempt + 1));
  }
  return null;
}

async function getText(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": "SkinFit-RAG-collector (contact: info@skinfitwellness.in)" } });
      if (res.ok) return await res.text();
      if (res.status === 404) return null;
    } catch {
      /* retry */
    }
    await sleep(800 * (attempt + 1));
  }
  return null;
}

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "-", mdash: "-", lsquo: "'", rsquo: "'", ldquo: '"', rdquo: '"', plusmn: "+/-", times: "x", deg: " deg", micro: "u", mu: "u", alpha: "alpha", beta: "beta" };
function decode(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => (ENT[n.toLowerCase()] !== undefined ? ENT[n.toLowerCase()] : m));
}
function plain(xml) {
  return decode(xml.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

// JATS full text -> [{ heading, text }]
function parseJats(xml) {
  const drop = (re) => (xml = xml.replace(re, " "));
  drop(/<back[\s\S]*?<\/back>/g);
  drop(/<table-wrap[\s\S]*?<\/table-wrap>/g);
  drop(/<fig[\s\S]*?<\/fig>/g);
  drop(/<supplementary-material[\s\S]*?<\/supplementary-material>/g);
  drop(/<xref[\s\S]*?<\/xref>/g);
  drop(/<disp-formula[\s\S]*?<\/disp-formula>/g);
  const sections = [];
  const abs = xml.match(/<abstract[\s\S]*?<\/abstract>/);
  if (abs) sections.push({ heading: "Abstract", text: plain(abs[0]) });
  const body = xml.match(/<body[\s\S]*?<\/body>/);
  if (body) {
    const secRe = /<sec[^>]*>([\s\S]*?)<\/sec>/g;
    let m;
    let found = false;
    while ((m = secRe.exec(body[0]))) {
      found = true;
      const inner = m[1];
      const title = (inner.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1];
      const paras = [...inner.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((x) => plain(x[1])).filter((t) => t.length > 40);
      if (paras.length) sections.push({ heading: title ? plain(title) : "", text: paras.join(" ") });
    }
    if (!found) {
      const paras = [...body[0].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((x) => plain(x[1])).filter((t) => t.length > 40);
      if (paras.length) sections.push({ heading: "", text: paras.join(" ") });
    }
  }
  return sections;
}

function chunkSections(sections, base) {
  const out = [];
  let n = 0;
  for (const sec of sections) {
    const words = sec.text.split(" ");
    let buf = "";
    const flush = () => {
      const t = buf.trim();
      if (t.length > 200 && n < MAX_CHUNKS_PER_ARTICLE) {
        out.push({ ...base, id: `${base.idBase}-${n}`, text: (sec.heading ? `${sec.heading}: ` : "") + t });
        n++;
      }
      buf = "";
    };
    for (const w of words) {
      if ((buf + " " + w).length > CHUNK_CHARS) flush();
      buf += (buf ? " " : "") + w;
    }
    flush();
    if (n >= MAX_CHUNKS_PER_ARTICLE) break;
  }
  return out.map(({ idBase, ...rest }) => rest);
}

async function main() {
  const only = arg("topics", "");
  const topics = only ? TOPICS.filter(([q]) => only.split(",").some((k) => q.includes(k.trim()))) : TOPICS;
  const seen = new Set();
  const chunks = [];
  const manifest = [];
  let skippedLicence = 0;

  for (const [topic, tags] of topics) {
    const q = `TITLE_ABS:(${topic}) AND (PUB_TYPE:"review" OR PUB_TYPE:"systematic review") AND OPEN_ACCESS:y AND (LICENSE:"cc by" OR LICENSE:"cc0")`;
    const url = `${BASE}/search?query=${encodeURIComponent(q)}&resultType=core&pageSize=${PER_TOPIC * 3}&format=json`;
    const data = await getJson(url);
    const results = data?.resultList?.result ?? [];
    let taken = 0;
    for (const r of results) {
      if (taken >= PER_TOPIC) break;
      const pmcid = r.pmcid;
      const lic = (r.license || "").toLowerCase().trim();
      if (!pmcid || seen.has(pmcid)) continue;
      if (!ALLOWED.has(lic)) {
        skippedLicence++;
        continue;
      }
      const xml = await getText(`${BASE}/${pmcid}/fullTextXML`);
      await sleep(180);
      if (!xml) continue;
      const sections = parseJats(xml);
      if (!sections.length) continue;
      const year = r.pubYear || "";
      const journal = r.journalTitle || r.journalInfo?.journal?.title || "";
      const source = `${plain(r.title || "").replace(/\.$/, "")} (${[journal, year].filter(Boolean).join(" ")}) ${pmcid} [${lic.toUpperCase()}] https://europepmc.org/article/PMC/${pmcid}`;
      const made = chunkSections(sections, {
        idBase: pmcid,
        source,
        pageHint: null,
        tags: [...new Set([...tags, topic])],
      });
      if (!made.length) continue;
      chunks.push(...made);
      manifest.push({ pmcid, title: plain(r.title || ""), journal, year, license: lic, url: `https://europepmc.org/article/PMC/${pmcid}`, topic, chunks: made.length });
      seen.add(pmcid);
      taken++;
    }
    console.log(`${topic}: ${taken} articles (running total ${seen.size} articles, ${chunks.length} chunks)`);
  }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(chunks));
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
  console.log(`\nDone: ${seen.size} articles, ${chunks.length} chunks, ${skippedLicence} candidates skipped for licence.`);
  console.log(`Wrote ${OUT} and ${MANIFEST}`);
}

main();
