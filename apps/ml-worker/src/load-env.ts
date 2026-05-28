/** Must run before any import that reads process.env (e.g. src/db/client). */
import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(
  typeof import.meta.dirname === "string"
    ? import.meta.dirname
    : fileURLToPath(new URL(".", import.meta.url)),
  "../../.."
);
if (!process.env.PROJECT_ROOT) {
  process.env.PROJECT_ROOT = root;
}
for (const name of [".env.local", ".env"] as const) {
  const p = resolve(root, name);
  if (existsSync(p)) loadEnv({ path: p });
}
