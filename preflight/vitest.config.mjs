import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export default {
  root,
  resolve: { alias: { "@": root } },
  test: { include: ["src/**/*.test.ts"], exclude: ["**/node_modules/**", ".next/**"] },
};
