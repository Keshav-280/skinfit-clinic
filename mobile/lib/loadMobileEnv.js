const fs = require("fs");
const path = require("path");

/** Load mobile/.env into process.env (prebuild/run:ios may not inherit shell env). */
function loadMobileDotEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

function readApiBaseFromEnvFile() {
  loadMobileDotEnv();
  return process.env.EXPO_PUBLIC_API_URL?.trim() ?? "";
}

function apiUsesHttp(apiBase) {
  const raw = apiBase?.trim();
  if (!raw) return false;
  try {
    return new URL(raw).protocol === "http:";
  } catch {
    return raw.toLowerCase().startsWith("http://");
  }
}

module.exports = {
  loadMobileDotEnv,
  readApiBaseFromEnvFile,
  apiUsesHttp,
};
