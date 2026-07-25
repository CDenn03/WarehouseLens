# WarehouseLens

An AI-powered multi-warehouse operations platform with a natural-language copilot for inventory, procurement, and outbound workflows. Built with Next.js, FastAPI, PostgreSQL, Keycloak, and a tool-routing agent benchmarked against forecasting baselines.

## What's real vs. scaffold-only

| Area | Status | Where |
|---|---|---|
| Database schema + Alembic migrations (0001–0006) | **Real** | `backend/app/models/`, `backend/migrations/` |
| Inventory / procurement / outbound CRUD + services | **Real** | `backend/app/services/`, `backend/app/api/v1/` |
| Picking → packing → shipping state machine | **Real** | `backend/app/services/outbound_service.py` |
| Dashboard KPIs + stock-trend + ABC ranking | **Real** | `backend/app/services/dashboard_service.py` |
| Prophet / XGBoost forecasting + backtest harness | **Real** | `backend/app/forecasting/` |
| Background worker (aggregation, reservation recompute, forecast refresh) | **Real** | `backend/app/worker.py` |
| Multi-tenant RBAC (6 roles, 21 permissions, warehouse-scope enforcement) | **Real** | `backend/app/core/permissions/`, `backend/app/core/security.py` |
| IAM admin API (user/role/warehouse assignment management) | **Real** | `backend/app/api/v1/iam.py` |
| Platform Admin (tenant CRUD, platform_admin role, bootstrap) | **Real** | `backend/app/api/v1/platform.py` |
| Logout (RP-initiated, Keycloak end-session) | **Real** | `frontend/src/app/api/auth/logout/route.ts` |
| Dashboard role-dispatch (platform vs. operational) | **Real** | `frontend/src/app/(app)/dashboard/page.tsx` |
| Frontend (all feature pages, platform dashboard, admin UI) | **Real** | `frontend/src/features/` |
| Seed-data generator | **Real** | `data/generate_seed_data.py` |
| Evaluation suite (gold answers + harness) | **Real** | `eval/` |
| **Keycloak** JWT validation | **Scaffold** | `backend/app/core/security.py` |
| **AI/agent** (LangGraph planner, tools, `/agent/query`) | **Scaffold** | `backend/app/agent/` |
| **Redis** (cache/lock client) | **Scaffold** | `backend/app/core/redis_client.py` |
| **Railway** deployment | **Checklist** | `RAILWAY.md` |

The RBAC *enforcement* is **real and tested** — JWT *validation* is scaffolded (reads `X-Debug-User` header in development so scoped-user behavior is testable before Keycloak is wired).

---

## Architecture

```
Browser ──────────────────────────────────────────────────────────────────────
         │  HttpOnly session cookie (Next.js → Keycloak OIDC)
         ▼
Next.js (BFF)  ─── decrypts session ──► Bearer token ──► FastAPI
         │                                                   │
         │  Server Actions / Server Components               │  JWT verify (JWKS)
         │  No tokens in client JS                          │  Resolve permissions (DB)
         ▼                                                   │  Enforce tenant + warehouse scope
  React UI                                             PostgreSQL
```

- **Backend** — FastAPI, thin-router / fat-service. Routers parse + scope-check + delegate to a service; services own all business logic and are the only thing that touches SQLAlchemy.
- **Frontend** — Next.js App Router, feature-based. Each `features/<domain>/` owns its `components/`, `actions/` (server actions), `services/` (API client calls), and `types.ts`.
- **Worker** — separate long-running process; the API writes a transaction and returns immediately, the worker aggregates asynchronously.

Full rationale, schema, and design decisions are in `docs/developer-guide.md`.

---

## Two-level identity model

```
Platform Admin (platform pseudo-tenant)
  └── creates Tenants
        └── each Tenant has: Users, Roles, Warehouses
```

| User type | Role | Bootstrapped by |
|---|---|---|
| Platform Admin | `platform_admin` | `PLATFORM_ADMIN_EMAIL` env var on first login |
| Tenant Admin | `tenant_admin` | `DEFAULT_TENANT_SUPERUSER_EMAIL` env var on first login |
| Warehouse Manager | `warehouse_manager` | Assigned by tenant admin |
| Procurement Officer | `procurement_officer` | Assigned by tenant admin |
| Auditor | `auditor` | Assigned by tenant admin |
| Full Operator | `admin` | Assigned by tenant admin |

See `docs/platform-admin.md` for the full bootstrap flow and `docs/permission-catalog.md` for the complete permission list.

---

## Running locally

### With Docker (the intended path)

```bash
cp .env.example .env
# Set PLATFORM_ADMIN_EMAIL and DEFAULT_TENANT_SUPERUSER_EMAIL in .env
docker compose up            # postgres, redis, keycloak, backend, worker, frontend
# Once postgres is up:
docker compose exec backend alembic upgrade head
docker compose exec backend python /app/../data/generate_seed_data.py
```

Frontend: http://localhost:3000 · Backend: http://localhost:8000/docs

### Backend without Docker

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL=postgresql+psycopg://wms:wms_dev_password@localhost:5432/wms
alembic upgrade head
python ../data/generate_seed_data.py
uvicorn app.main:app --reload
python -m app.worker          # separate shell
```

### Frontend without Docker

```bash
cd frontend
npm install
API_URL=http://localhost:8000 npm run dev
```

---

## Key environment variables

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql+psycopg://wms:wms_dev_password@localhost:5432/wms` |
| `PLATFORM_ADMIN_EMAIL` | Email of the platform superuser (bootstrapped on first login) | `platform@warehouselens.local` |
| `DEFAULT_TENANT_SUPERUSER_EMAIL` | Email of the default tenant's first admin | `admin@warehouselens.local` |
| `KEYCLOAK_ISSUER` | Keycloak realm URL | `http://localhost:8080/realms/warehouselens` |
| `NEXTAUTH_URL` | Public URL of the Next.js app | `http://localhost:3000` |
| `KEYCLOAK_CLIENT_ID` | NextAuth Keycloak client | `warehouselens-frontend` |
| `KEYCLOAK_CLIENT_SECRET` | Client secret | — |

---

## Tests

```bash
cd backend && .venv/bin/pytest              # 94 tests
python eval/run_eval.py --api http://localhost:8000
python -m app.forecasting.backtest --folds 4 --horizon 14
```

Tests cover: outbound state machine, RBAC scope enforcement, dashboard math, worker aggregation, IAM assignment/revocation (including self-lockout and cross-tenant guards), platform admin tenant CRUD, permission catalog integrity.

---

## RBAC quick reference (development)

Before Keycloak is wired up, impersonate any user with the `X-Debug-User` header. Permissions are resolved from the database — the header provides identity only:

```
X-Debug-User: <sub>:<username>:placeholder
```

The user must exist in `users` and have a `user_roles` row for their tenant.

---

## Repo layout

```
warehouselens/
├── backend/
│   ├── app/
│   │   ├── api/v1/          # routers: inventory, procurement, outbound,
│   │   │                    #          dashboard, iam, platform, agent, forecast
│   │   ├── core/
│   │   │   ├── permissions/ # permission constants + role definitions
│   │   │   └── security.py  # JWT auth, tenant resolution, scope enforcement
│   │   ├── models/          # SQLAlchemy ORM models
│   │   ├── schemas/         # Pydantic request/response schemas
│   │   ├── services/        # business logic (one file per domain)
│   │   ├── forecasting/     # Prophet + XGBoost models + backtest
│   │   ├── agent/           # LangGraph planner scaffold + tools
│   │   └── worker.py        # background aggregation process
│   ├── migrations/          # Alembic migrations 0001–0006
│   └── tests/               # 94 pytest tests
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js App Router pages
│   │   ├── features/        # feature modules (dashboard, inventory,
│   │   │                    #   procurement, outbound, copilot, admin, platform)
│   │   ├── components/      # shared UI components
│   │   └── lib/             # api client, auth helpers, token refresh
├── data/                    # generate_seed_data.py
├── eval/                    # queries.jsonl + run_eval.py
├── docs/                    # architecture and design documentation
├── docker-compose.yml
└── RAILWAY.md
```
