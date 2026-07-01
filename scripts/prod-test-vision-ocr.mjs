#!/usr/bin/env node
/** Smoke-test vision OCR inside the production web container. Usage: node scripts/prod-test-vision-ocr.mjs /path/to/report.pdf */
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error("Usage: node scripts/prod-test-vision-ocr.mjs <report.pdf>");
  process.exit(1);
}

const key = process.env.OPENAI_API_KEY?.trim();
if (!key) {
  console.error("OPENAI_API_KEY missing");
  process.exit(1);
}

const model = process.env.SKINFIT_REPORT_VISION_MODEL?.trim() || process.env.OPENAI_CHAT_MODEL?.trim() || "gpt-4o-mini";
const python = process.env.SDETECT_QR_PYTHON || "/opt/identity-venv/bin/python3";
const renderScript = path.join(process.cwd(), "scripts/sdetect_render_pdf.py");
const pdfBuffer = readFileSync(pdfPath);

function renderPages(buf) {
  return new Promise((resolve, reject) => {
    const proc = spawn(python, [renderScript], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    proc.stdout.on("data", (c) => (stdout += String(c)));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code !== 0) return reject(new Error(`render exit ${code}`));
      try {
        resolve(JSON.parse(stdout.trim()).images ?? []);
      } catch (e) {
        reject(e);
      }
    });
    proc.stdin.write(buf);
    proc.stdin.end();
  });
}

async function main() {
  const images = await renderPages(pdfBuffer);
  console.log("rendered_pages:", images.length);
  if (!images.length) process.exit(2);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: 'Read this skin report image. Return JSON: {"name":string|null,"comprehensiveScore":number|null,"classification":string|null}',
            },
            {
              type: "image_url",
              image_url: { url: `data:image/png;base64,${images[0]}`, detail: "high" },
            },
          ],
        },
      ],
    }),
  });

  const body = await res.json();
  if (!res.ok) {
    console.error("openai_error:", body?.error?.message || res.status);
    process.exit(3);
  }

  const txt = body.choices?.[0]?.message?.content;
  console.log("vision_result:", txt);
  console.log("key_last4:", key.slice(-4));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
