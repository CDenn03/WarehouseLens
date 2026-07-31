# ORACLE_CLOUD.md — manual deployment checklist (Always Free)

You'll do every step below yourself in the Oracle Cloud and Neon consoles and over SSH — same
philosophy as [RAILWAY.md](./RAILWAY.md): nothing here is scripted except the parts that are
genuinely just config (the compose file, the Caddyfile). Written for someone who has never used
Oracle Cloud. Budget ~2 hours the first time, more if you hit the capacity issue in step 2.

**Why this instead of Railway:** Railway's free tier is 0.5GB RAM total — not enough to run
Keycloak (~1GB alone) plus everything else. Oracle's Always Free Ampere A1 shape gives you 2 OCPU
/ 12GB RAM (reduced from 24GB in June 2026, still plenty) for $0, indefinitely, not a trial.

**The target shape:** one Ampere A1 VM running the *entire* stack via
[`docker-compose.prod.yml`](./docker-compose.prod.yml) — backend, worker, frontend, keycloak,
redis, plus Caddy for TLS. Postgres stays on Neon, exactly like the Railway plan. Only Caddy's
80/443 are reachable from the internet; everything else talks over the compose network.

## 1. Provision Neon (same as RAILWAY.md step 1)

- [ ] Create a Neon project. Note the **pooled** connection string (the app uses this) and the
      **direct** one (migrations use this).
- [ ] Create a second database in the same project named `keycloak` — its own database, not a
      schema in `wms`, so you can reset app data without touching realm config.
- [ ] From your local machine (not the VM, not a container — a plain Python environment with
      `backend/requirements.txt` installed): `DATABASE_URL=<neon-direct-url> alembic upgrade
      head` (from `backend/`), then `DATABASE_URL=<neon-direct-url> python
      data/generate_seed_data.py` (from the repo root). Same as RAILWAY.md step 1 — do this once,
      before anything else, since the seed script refuses to run twice.

## 2. Create the Always Free VM

- [ ] Sign up at cloud.oracle.com. A card is required for identity verification — Always Free
      resources are never charged unless you explicitly upgrade past them.
- [ ] Compute → Instances → Create Instance.
  - Image: **Ubuntu 24.04** (Canonical's official image).
  - Shape: **VM.Standard.A1.Flex** (Ampere, ARM) — set it to 2 OCPU / 12GB RAM, the full Always
    Free allowance.
  - Add your SSH public key (or let Oracle generate a keypair and download it).
  - Boot volume: leave the default; you have 200GB Always Free block storage total if you need
    more later.
- [ ] **If you get "Out of capacity for shape VM.Standard.A1.Flex":** this is a known, common
      issue — free Ampere capacity is oversubscribed in popular regions. Try a different
      availability domain (the dropdown in the same form), try again in a few hours, or try a
      different region if your tenancy allows choosing one at signup. This is a capacity queueing
      problem, not a billing problem — you don't need to pay to fix it.
- [ ] Note the instance's **public IP** once it's running.

## 3. Prepare the VM

SSH in (`ssh ubuntu@<public-ip>`) and do the following:

- [ ] Install Docker: `curl -fsSL https://get.docker.com | sh`, then
      `sudo usermod -aG docker $USER` and re-login so `docker` works without `sudo`.
- [ ] Open the firewall. Oracle VMs have **two** independent firewalls — missing either one is
      the most common "I can't reach my VM" mistake:
  - Cloud-level: in the console, edit the VM's **Security List** (or attach a Network Security
    Group) to allow ingress on **80** and **443** from `0.0.0.0/0`, and **22** from your own IP.
  - OS-level: Ubuntu images on Oracle ship with `iptables` rules that block inbound traffic by
    default even after the security list allows it. Check `sudo iptables -L INPUT -n` — if you
    see restrictive rules, add `sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT` and the same
    for 443, then persist with `sudo netfilter-persistent save` (or `iptables-persistent` if not
    installed: `sudo apt install iptables-persistent`).
- [ ] `git clone` this repo onto the VM (or `scp` it up — either works; nothing here needs
      GitHub Actions).

## 4. Domain and DNS

You need two hostnames pointed at the VM's public IP — one for the frontend, one for Keycloak
(browsers redirect to it for login, so it needs to be a real public HTTPS endpoint, not internal).

- [ ] **If you already own a domain:** add two `A` records, e.g. `app.yourdomain.com` and
      `auth.yourdomain.com`, both pointing at the VM's public IP.
- [ ] **If you don't want to buy one:** a free dynamic-DNS subdomain (e.g. DuckDNS) works fine —
      Let's Encrypt (which Caddy uses automatically) will issue certificates for it the same as a
      paid domain. You'd get something like `warehouselens.duckdns.org` for the frontend; DuckDNS
      only gives you one subdomain per free account, so either register a second one for Keycloak
      or run both frontend and Keycloak on subpaths of one domain instead (that needs Caddy path
      routing instead of the two-domain setup below — a reasonable follow-up if you go this
      route, but the two-domain version is simpler to get right the first time).
- [ ] Wait for DNS to actually resolve (`dig +short app.yourdomain.com`) before starting Caddy —
      it needs to reach your domain to prove ownership to Let's Encrypt.

## 5. Keycloak realm and clients

Same realm/client shape as local dev, just with production URLs:

- [ ] Once Keycloak is up (step 6), log into its admin console at `https://<keycloak-domain>` with
      the `KEYCLOAK_ADMIN_USERNAME`/`KEYCLOAK_ADMIN_PASSWORD` from `.env.prod`.
- [ ] Create the `warehouselens` realm (or import it, if this repo has a realm export — check
      `backend/` for one before doing this by hand).
- [ ] `warehouselens-backend` client: confidential, used for backend token validation only — no
      redirect URIs needed unless you plan to use Swagger's OAuth login at a public `/docs` (this
      setup doesn't expose the backend publicly, so skip that).
- [ ] `warehouselens-frontend` client: confidential, with **Valid Redirect URIs** set to
      `https://<frontend-domain>/api/auth/callback/*` and **Valid Post Logout Redirect URIs** to
      `https://<frontend-domain>/*`. Copy its client secret into `.env.prod`'s
      `KEYCLOAK_CLIENT_SECRET`.
- [ ] `backend/scripts/seed_keycloak_user.py` can provision this instead of doing it by hand —
      check its `--help` before reaching for the admin console.

## 6. Deploy

On the VM, in the repo directory:

- [ ] `cp .env.prod.example .env.prod` and fill in every value — see the file's own comments.
      `DATABASE_URL` and `KEYCLOAK_DB_URL`/`KEYCLOAK_DB_USERNAME`/`KEYCLOAK_DB_PASSWORD` come from
      Neon (step 1); `KEYCLOAK_CLIENT_SECRET` comes from step 5.
- [ ] Double-check `ENVIRONMENT=production` is set. This isn't optional — it's what disables the
      `X-Debug-User` identity-bypass header that local dev and the test suite rely on
      (`app/core/security.py`). Leaving it unset lets anyone authenticate as anyone.
- [ ] Build and start everything:
      `docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build`
- [ ] Run migrations as a **deliberate one-off step**, not automatically on boot (see
      `backend/entrypoint.sh`'s own comment on why — the backend and worker share an image and
      would race for the same DDL lock if both auto-migrated):
      `docker compose -f docker-compose.prod.yml --env-file .env.prod run --rm backend alembic upgrade head`
      (redundant if you already ran migrations from your local machine in step 1 against the same
      Neon database — safe to run again either way, Alembic no-ops on an up-to-date schema).
- [ ] Make it survive a VM reboot: `sudo systemctl enable docker` (Ubuntu's Docker install from
      step 3 usually does this already — confirm with `systemctl is-enabled docker`). Every
      service in `docker-compose.prod.yml` is already `restart: unless-stopped`, so a reboot
      brings the whole stack back once the Docker daemon is up.

## 7. Verify

- [ ] `https://<frontend-domain>` loads and redirects to Keycloak login.
- [ ] Log in — confirm the dashboard renders with seeded data.
- [ ] `docker compose -f docker-compose.prod.yml logs -f worker` — you should see the aggregation
      tick every few minutes (`worker_aggregation_interval`, default 300s).
- [ ] `docker compose -f docker-compose.prod.yml ps` — backend, worker, redis, keycloak should
      show no published ports except through `caddy`; confirm `curl http://localhost:8000/health`
      works *from the VM* but isn't reachable from outside it.
- [ ] Ask the copilot a question — confirms `LLM_API_KEY` made it through correctly.

## 8. Ongoing

- [ ] `sudo apt update && sudo apt upgrade` occasionally — this VM is fully yours to patch, unlike
      Railway's managed containers.
- [ ] Watch Oracle's dashboard for any further Always Free policy changes — the June 2026 halving
      (24GB → 12GB) happened with no announcement, so check back periodically rather than assuming
      the current allowance is permanent.
- [ ] Neon's free tier has its own storage/compute limits — unrelated to Oracle's, worth knowing
      independently if the app's data grows.

**Not doing:** multi-VM/HA setup (one Always Free VM is the entire point — a second one only
makes sense if you outgrow it, which isn't the point of a small personal project), and not
containerizing Postgres locally (Neon's automated backups and connection pooling are worth more
than the RAM you'd save).
