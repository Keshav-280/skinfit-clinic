# Bastion host — secure DB access from your Mac

RDS stays **private**. A small EC2 instance in a **public subnet** accepts SSH **only from your IP**. You tunnel Postgres to `127.0.0.1:5434` and run Drizzle from the laptop.

## Before updating CloudFormation

1. **Public IP** — open [whatismyip.com](https://whatismyip.com) and copy your **IPv4** (e.g. `123.45.67.89`).
2. **Key pair** — EC2 → Key Pairs → Create **`skinfit-key`** → save `skinfit-key.pem` to the repo root (gitignored via `*.pem`).

## Stack update (AWS Console)

1. CloudFormation → **skinfit-infrastructure** → **Update stack** → replace template with `infra/cloudformation.yaml`.
2. Parameters:
   - **DBPassword** — same password you used before (or a new one; keep it saved).
   - **BastionAllowedIp** — your IPv4 from step 1 (no `/32`; template adds it).
   - **BastionKeyName** — `skinfit-key`
3. Submit update → wait for **UPDATE_COMPLETE**.
4. **Outputs** → note **BastionPublicIp** and **RDSEndpoint**.

If your home IP changes later, run another stack update with the new **BastionAllowedIp**.

## One-time: key permissions

```bash
chmod 400 skinfit-key.pem
```

## Open the tunnel (leave this terminal running)

Replace `BASTION_IP` and `RDS_HOST` from stack Outputs:

```bash
ssh -i skinfit-key.pem \
  -o StrictHostKeyChecking=accept-new \
  -N -L 5434:RDS_HOST:5432 \
  ec2-user@BASTION_IP
```

Example (your RDS host may differ):

```bash
# Copy Endpoint exactly from RDS console (Connectivity & security) — typos cause NXDOMAIN
ssh -i skinfit-key.pem -N -L 5434:skinfit-db.cp46qoeo0o7n.ap-south-1.rds.amazonaws.com:5432 ec2-user@BASTION_IP
```

## Run migrations (second terminal)

```bash
# .env.aws — password = stack DBPassword, host = 127.0.0.1, port = 5434
export AWS_RDS_URL='postgresql://skinfit:YOUR_PASSWORD@127.0.0.1:5434/skinfit'
# Do not use sslmode=require on 127.0.0.1 — it breaks drizzle-kit (cert hostname mismatch).

npm run db:bootstrap-aws
# Then sync any schema drift:
npm run db:push
# npm run db:seed   # only for empty dev/staging DBs
```

Optional GUI: Drizzle Studio with the same `AWS_RDS_URL`:

```bash
npm run db:studio
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Permission denied (publickey)` | Key path, `chmod 400`, key name matches **BastionKeyName** |
| SSH times out | Wrong IP in **BastionAllowedIp**; update stack after IP change |
| `connection refused` on 5434 | Tunnel terminal not running; wrong **RDSEndpoint** in `-L` |
| Migrate still uses Docker DB | `unset LOCAL_POSTGRES_URL` |
