# Nginx reverse proxy (Skinfit)

Nginx sits in front of the `web` container(s) so users hit **port 80/443** instead of `:3000`.

## Do we have “multiple backend servers”?

| What you have | Role | Behind nginx? |
|---------------|------|----------------|
| **web** | Next.js app + API | **Yes** — this is what nginx load-balances |
| **ml-worker** | Background jobs (BullMQ) | No — not HTTP for users |
| **ml-inference** | Face ML API | No — only `ml-worker` calls it internally |
| **postgres**, **redis** | Data / queue | No |

So you have **several services**, but only **one type** is a public HTTP backend: **`web`**.

Today on the VM you usually run **one** `web` container. Nginx still helps (port 80, HTTPS, headers) even with a single backend.

To use nginx as a **load balancer**, run **multiple `web` replicas** on the same VM (or multiple VMs — see below).

## Quick start on prod VM (`/opt/skinfit`)

```bash
cd /opt/skinfit
git pull

# 1) Open security group: allow TCP 80 (and 443 if using TLS on VM)
# 2) Set public URLs in .env.local (use your domain or Elastic IP)
```

In `.env.local` (adjust host):

```bash
NEXT_PUBLIC_APP_URL=http://13.234.166.154
AUTH_URL=http://13.234.166.154
PUBLIC_UPLOAD_BASE_URL=http://13.234.166.154/api/files
```

If you use a **domain + HTTPS** (recommended), use `https://yourdomain.com` for all three.

For Auth.js / session cookies behind a proxy, add to `.env`:

```bash
AUTH_TRUST_HOST=true
```

Rebuild and start with the prod overlay:

```bash
docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml up -d --build web nginx
```

Test:

```bash
curl -sI http://127.0.0.1/healthz
curl -sI http://127.0.0.1/ | head -5
```

Browser: `http://13.234.166.154/` (no `:3000`).

After nginx works, **remove** inbound **3000** from the EC2 security group (keep 22, 80, 443).

---

## Multiple `web` backends (one VM)

Scale the app container; nginx spreads HTTP across replicas:

```bash
cd /opt/skinfit
docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml up -d --scale web=2 --no-recreate nginx
docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml up -d --build --scale web=2
```

Check:

```bash
docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml ps web
```

**Limits on one VM:** 2× `web` helps when many people hit the **website/API** at once. It does **not** speed up **ML scans** (`ml-worker` / `ml-inference` are still one-at-a-time unless you scale those separately). You need enough **RAM/CPU** for 2+ Node processes.

**Sessions:** use a shared session store (your Redis) so login works on any replica — you already use Redis for cache/queue.

---

## Multiple VMs (true multi-server)

For several EC2 instances, point nginx upstream at each private IP:

```nginx
upstream skinfit_web_manual {
  server 10.0.1.10:3000;
  server 10.0.1.11:3000;
  keepalive 32;
}
```

That needs a **second compose file or host nginx** on a dedicated proxy VM / ALB. The cheap single-VM setup uses Docker service name `web` instead.

---

## Compose files

| File | Purpose |
|------|---------|
| `docker/docker-compose.yml` | Full stack (local dev; exposes 3000) |
| `docker/docker-compose.prod.yml` | Adds `nginx`, hides public `ml-inference` port |

Always run from repo root with **both** files on the server:

```bash
docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml <command>
```

---

## Option A — Cloudflare (easiest TLS)

1. Point DNS **A record** → Elastic IP `13.234.166.154`.
2. Cloudflare proxy **on** (orange cloud).
3. SSL/TLS mode: **Full** (or Full strict if you add origin certs later).
4. Origin connects to VM on **port 80** only; nginx config in `conf.d/skinfit.conf` is enough.
5. Set env URLs to `https://yourdomain.com`.

---

## Option B — Let's Encrypt on the VM

1. Temporarily ensure port **80** is open.
2. On the host (not in Docker), install certbot and obtain a cert:

```bash
sudo apt-get update && sudo apt-get install -y certbot
sudo certbot certonly --standalone -d yourdomain.com --agree-tos -m you@email.com --non-interactive
```

3. Copy `nginx/conf.d/skinfit-ssl.conf.example` → `nginx/conf.d/skinfit-ssl.conf`, replace `YOUR_DOMAIN`.
4. In `docker/docker-compose.prod.yml`, uncomment the `/etc/letsencrypt` volume on `nginx`.
5. Recreate nginx:

```bash
docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml up -d --force-recreate nginx
```

6. Update `.env.local` to `https://yourdomain.com` and recreate `web`:

```bash
docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml up -d --force-recreate web
```

Renewal (cron on host):

```bash
sudo certbot renew --quiet && docker compose -f /opt/skinfit/docker/docker-compose.yml -f /opt/skinfit/docker/docker-compose.prod.yml exec nginx nginx -s reload
```

---

## Logs

```bash
docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml logs -f nginx
docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml exec nginx tail -f /var/log/nginx/skinfit.error.log
```

---

## Troubleshooting

| Symptom | Check |
|---------|--------|
| 502 Bad Gateway | `docker compose ... ps web` — is web healthy on 3000 inside network? |
| Still need `:3000` | Prod overlay not used, or SG only allows 3000 |
| Login redirect loop | `AUTH_URL` / `NEXT_PUBLIC_APP_URL` must match browser URL; set `AUTH_TRUST_HOST=true` |
| Upload too large | `client_max_body_size` in `nginx/conf.d/skinfit.conf` (default 64m) |
