# Web app (`apps/web`)

The Next.js 16 app currently lives at the **repository root** (`app/`, `components/`, `src/`) for stable imports and existing Vercel/Render deploys.

New infrastructure APIs:

| Route | Purpose |
|-------|---------|
| `POST /api/uploads` | Store file locally; returns `{ path, url }` |
| `GET /api/files/*` | Authenticated file download |
| `POST /api/scans/submit` | Async scan (`SCAN_ASYNC_MODE=1`) → `202 { jobId }` |
| `GET /api/scans/status/[jobId]` | Poll job status |
| `POST /api/scan` | Legacy synchronous flow (until clients migrate) |

Future migration: move `app/` + `components/` here and set `package.json` `name` to `@skinfit/web`.
