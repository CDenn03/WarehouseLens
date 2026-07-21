# RAILWAY.md — manual deployment checklist

You'll do every step below yourself in the Railway and Neon dashboards — nothing here is
scripted, on purpose (Railway is one of the four learning areas). Written for someone who
has never used Railway. Budget ~1–2 hours the first time. Do this **after Phase 1**
(schema + compose working locally), not at the end of the term.

The target shape: one Railway **project** containing five **services** (frontend, backend,
worker, keycloak, redis) on a shared private network, plus **Neon** for Postgres (outside
Railway). Only the frontend gets a public domain.

## 1. Provision Neon first (Postgres lives outside Railway)

- [ ] Create an account at neon.tech and create a project (pick a region close to your Railway region).
- [ ] Note that Neon gives you **two** connection strings per database: a **direct** one and a
      **pooled** (PgBouncer) one. Copy both.
- [ ] Create a **second database** in the same Neon project named `keycloak`. Keycloak gets its
      own database (not a schema in `wms`) so you can drop/reseed the app's data without
      destroying your realm config.
- [ ] From your local machine, run the Alembic migrations once against the **direct** string:
      `DATABASE_URL=<neon-direct-url> alembic upgrade head` (from `backend/`).
      Migrations want the direct connection; the *app* will use the pooled one.
- [ ] Seed it: `DATABASE_URL=<neon-direct-url> python data/generate_seed_data.py`.

Why pooled for the app: Railway services restart independently, and every restart opens fresh
connections. Neon's direct connection limit is small; PgBouncer absorbs the churn.

## 2. Create the Railway project

- [ ] Sign up at railway.app (GitHub login is easiest — it also grants repo access for deploys).
- [ ] "New Project" → "Deploy from GitHub repo" → pick this repo. That creates the project and
      a first service; you'll add the rest inside the same project so they share a private network.

## 3. Add each service

Railway builds a service from the repo using a **root directory** + Dockerfile, or from a
public image. You need five:

- [ ] **backend** — source: this repo, root directory `backend/` (it finds `backend/Dockerfile`).
      Leave the start command as the Dockerfile's (uvicorn on port 8000).
- [ ] **worker** — source: this repo, root directory `backend/` again (same image!), but override
      the **start command** to `python -m app.worker`. Give it its own restart policy (on-failure).
      Decision to make: Railway also has "cron jobs" as a service type — a cron job that runs the
      aggregation script and exits would be cheaper, but our worker is written as a long-running
      polling loop (it also refreshes forecasts on a slower cadence), so a normal always-on
      service is the straightforward mapping. Revisit if cost matters.
- [ ] **frontend** — source: this repo, root directory `frontend/`.
- [ ] **keycloak** — source: **Docker image** `quay.io/keycloak/keycloak:25.0` (not the repo).
      Set the start command to `start --optimized` (NOT `start-dev` — that's local-only).
- [ ] **redis** — add via Railway's **database/plugin catalog** ("Add service" → "Database" →
      Redis). It's managed; no config needed. It exposes `REDIS_URL` as a referenceable variable.

## 4. Set variables (per service — Railway scopes variables to a service)

Use Railway's "Variables" tab on each service. Use **references** (`${{service.VAR}}`) where
Railway offers them so values stay in one place.

- [ ] **backend** and **worker** (same set):
  - `DATABASE_URL` = the Neon **pooled** connection string
  - `REDIS_URL` = reference the Redis service's URL
  - `KEYCLOAK_ISSUER_URL` = `http://keycloak.railway.internal:8080/realms/warehouselens`
  - `KEYCLOAK_CLIENT_ID` = `warehouselens-backend`
  - `LLM_API_KEY`, `LLM_MODEL` = your values
- [ ] **frontend**:
  - `API_URL` = `http://backend.railway.internal:8000` (private network — the frontend's
    server-side code calls the backend internally, never over a public URL)
- [ ] **keycloak**:
  - `KEYCLOAK_ADMIN`, `KEYCLOAK_ADMIN_PASSWORD` = pick real values (no longer `admin`/`admin`)
  - `KC_DB` = `postgres`
  - `KC_DB_URL` = `jdbc:postgresql://<neon-host>/keycloak?sslmode=require` (the second database)
  - `KC_DB_USERNAME` / `KC_DB_PASSWORD` = from Neon
  - `KC_HOSTNAME` = the Railway-issued domain you'll generate for Keycloak in step 5
  - `KC_HTTP_ENABLED` = `true` (Railway terminates TLS at the edge)

## 5. Domains and networking

- [ ] **frontend**: Settings → Networking → "Generate Domain". This is the app's public URL —
      the only service that gets one.
- [ ] **keycloak**: also needs a public domain **if** users' browsers must reach the login page
      (they do, in a standard OIDC redirect flow). Generate one, then set `KC_HOSTNAME` to it.
      Decision to note: backend↔Keycloak token validation can stay on the private hostname, but
      then the JWT `iss` claim (public hostname) won't match the internal issuer URL — either
      validate against the public issuer or configure Keycloak's hostname options for a split
      frontend/backend URL. Worth reading Keycloak's `KC_HOSTNAME` docs when you wire auth up.
- [ ] Confirm backend, worker, redis have **no** public domain. Private DNS is
      `<service-name>.railway.internal`.

## 6. Health checks and boot order

- [ ] On the backend service, set the healthcheck path to `/health`.
- [ ] Keycloak is the slowest service to boot. There is no `depends_on` in Railway — the backend
      simply retries on connection failure at startup (already built in) rather than crash-looping.
      If you see restart loops on first deploy, check Keycloak's `/health/ready` before debugging
      the backend.

## 7. Verify

- [ ] Open the frontend's public domain — dashboard renders with seeded data.
- [ ] `railway logs` (or the dashboard Logs tab) on the worker — you should see the aggregation
      tick every few minutes.
- [ ] Hit `https://<backend-internal-check>` — you can't, and that's correct. Use the frontend
      or `railway run curl http://backend.railway.internal:8000/health` to verify the backend.

**Not doing:** serverless for backend/worker (long-running polling process + stateful JVM don't
fit scale-to-zero), and not swapping Keycloak for a hosted auth provider (it's load-bearing for
the four-role RBAC model). See docs/developer-guide.md Section 11.
