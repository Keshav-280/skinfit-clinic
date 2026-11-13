// Face annotator for the Medixora front photos. No login: the link itself is the secret.
//
//   Local:      node tools/face-annotator/server.mjs                     (http://localhost:5050/?k=<key>)
//   On the VM:  runs in its own container behind nginx at /annotateimages/ (see docker-compose.prod.yml)
//
// Environment (all optional):
//   DATA_DIR     where photos, annotations and the key live            (default: ./data next to this file)
//   PORT         port to listen on                                      (default 5050)
//   HOST         address to listen on; use 0.0.0.0 inside a container   (default 127.0.0.1)
//   BASE_PATH    public path prefix, e.g. /annotateimages               (default none; used for the cookie)
//   PUBLIC_URL   public address printed with the secret link            (default http://localhost:PORT)
//   ACCESS_KEY   overrides the key stored in DATA_DIR/.access-key
//
// Photos:       DATA_DIR/images/<id>.jpg
// Annotations:  DATA_DIR/annotations/<annotator>/<id>.json
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR || path.join(here, "data");
const imgDir = path.join(dataDir, "images");
const annDir = path.join(dataDir, "annotations");
const PORT = Number(process.env.PORT || 5050);
const HOST = process.env.HOST || "127.0.0.1";
const BASE_PATH = (process.env.BASE_PATH || "").replace(/\/+$/, "");
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/+$/, "");
fs.mkdirSync(dataDir, { recursive: true });

// The key is a long random code, made once and kept in DATA_DIR/.access-key.
// Delete that file and restart to make a new key (the old link stops working at once).
const keyFile = path.join(dataDir, ".access-key");
if (!process.env.ACCESS_KEY && !fs.existsSync(keyFile)) fs.writeFileSync(keyFile, crypto.randomBytes(18).toString("base64url"));
const ACCESS_KEY = (process.env.ACCESS_KEY || fs.readFileSync(keyFile, "utf8")).trim();
const sameKey = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const cookieKey = (req) => /(?:^|;\s*)ak=([^;]+)/.exec(req.headers.cookie || "")?.[1] || "";

const ID = /^[0-9a-f]{12}$/;
const cleanName = (n) => String(n || "").toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
const send = (res, code, body, type = "application/json", extra = {}) => {
  res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer", ...extra });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
const listIds = () =>
  fs.existsSync(imgDir)
    ? fs.readdirSync(imgDir).filter((f) => /^[0-9a-f]{12}\.jpg$/.test(f)).map((f) => f.slice(0, 12)).sort()
    : [];

function readAnnotations(annotator) {
  const dir = path.join(annDir, annotator);
  const out = {};
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir)) {
    if (!/^[0-9a-f]{12}\.json$/.test(f)) continue;
    try {
      out[f.slice(0, 12)] = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    } catch {
      /* ignore a half-written file */
    }
  }
  return out;
}
function summary(annotator) {
  const out = {};
  for (const [id, j] of Object.entries(readAnnotations(annotator))) {
    const scored = Object.values(j.scores ?? {}).filter((v) => Number.isFinite(v)).length;
    out[id] = { scored, shapes: (j.shapes ?? []).length, done: scored === 6 };
  }
  return out;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const p = url.pathname;
  try {
    if (p === "/healthz") return send(res, 200, "ok\n", "text/plain"); // no data, no key needed
    // Opening the secret link once sets a cookie and then goes to the app without the key in the address bar.
    const given = url.searchParams.get("k");
    if (given && sameKey(given, ACCESS_KEY)) {
      return send(res, 302, "", "text/plain", { "Set-Cookie": `ak=${ACCESS_KEY}; Path=${BASE_PATH || "/"}; HttpOnly; SameSite=Lax; Max-Age=2592000`, Location: "./" });
    }
    if (!sameKey(cookieKey(req), ACCESS_KEY)) {
      return send(res, 401, "This page needs the private link you were given.", "text/plain; charset=utf-8");
    }
    if (req.method === "GET" && (p === "/" || p === "/index.html")) {
      return send(res, 200, fs.readFileSync(path.join(here, "index.html")), "text/html; charset=utf-8");
    }
    if (req.method === "GET" && p === "/api/images") return send(res, 200, listIds());
    if (req.method === "GET" && p === "/api/progress") return send(res, 200, summary(cleanName(url.searchParams.get("annotator"))));
    if (req.method === "GET" && p === "/api/export") {
      // Everything every annotator has saved, as one file (open it in the same browser to download).
      const all = {};
      if (fs.existsSync(annDir)) for (const who of fs.readdirSync(annDir)) all[who] = readAnnotations(who);
      return send(res, 200, JSON.stringify({ exportedAt: new Date().toISOString(), annotators: all }, null, 1), "application/json", {
        "Content-Disposition": 'attachment; filename="face-annotations.json"',
      });
    }
    let m = p.match(/^\/img\/([0-9a-f]{12})\.jpg$/);
    if (req.method === "GET" && m) {
      const f = path.join(imgDir, `${m[1]}.jpg`);
      if (!fs.existsSync(f)) return send(res, 404, { error: "not found" });
      res.writeHead(200, { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600", "X-Robots-Tag": "noindex, nofollow" });
      return fs.createReadStream(f).pipe(res);
    }
    m = p.match(/^\/api\/annotation\/([0-9a-f]{12})$/);
    if (m) {
      const who = cleanName(url.searchParams.get("annotator"));
      if (!who) return send(res, 400, { error: "annotator name needed" });
      const f = path.join(annDir, who, `${m[1]}.json`);
      if (req.method === "GET") return send(res, 200, fs.existsSync(f) ? fs.readFileSync(f) : "null");
      if (req.method === "POST") {
        let body = "";
        req.on("data", (c) => {
          body += c;
          if (body.length > 2_000_000) req.destroy();
        });
        req.on("end", () => {
          try {
            const j = JSON.parse(body);
            fs.mkdirSync(path.join(annDir, who), { recursive: true });
            const tmp = `${f}.tmp`;
            fs.writeFileSync(tmp, JSON.stringify(j, null, 1));
            fs.renameSync(tmp, f);
            send(res, 200, { ok: true });
          } catch {
            send(res, 400, { error: "bad json" });
          }
        });
        return;
      }
    }
    send(res, 404, { error: "not found" });
  } catch (e) {
    send(res, 500, { error: String(e?.message ?? e) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Face annotator running (${listIds().length} photos). Data folder: ${dataDir}`);
  console.log(`Private link: ${PUBLIC_URL}${BASE_PATH}/?k=${ACCESS_KEY}`);
  console.log("Anyone with this link can open the tool and see the photos. Share it only with the annotators.");
});
