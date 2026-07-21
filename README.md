# WarehouseLens

A multi-warehouse operations app with an AI copilot: inventory + procurement core,
a picking → packing → shipping workflow, per-warehouse demand forecasting, a
warehouse-scoped RBAC model, and a planner/tool-routing agent over the operational
data.

Built from `docs/developer-guide.md` (the spec). This README covers how to run it and,
importantly, **what is deliberately scaffolded vs. built for real** — see below.

## What's real vs. scaffold-only

This project is a learning vehicle for four technologies, so those four are intentionally
left as **annotated scaffolds** — real file layout, signatures, and config shape, with
`TODO(learning)` comments explaining what goes where, why, and which design decisions are
open. Everything else is fully implemented, tested, and verified end to end.

| Area | Status | Where |
|---|---|---|
| Database schema + Alembic migrations | **Real** | `backend/app/models/`, `backend/migrations/` |
| Inventory / procurement / outbound CRUD + services | **Real** | `backend/app/services/`, `backend/app/api/v1/` |
| Picking → packing → shipping workflow (state machine, reservations, transfers) | **Real** | `backend/app/services/outbound_service.py` |
| Sales-order stub → outbound-request trigger | **Real** | `outbound_service.create_sales_order` |
| Dashboard KPIs + stock-trend + ABC ranking | **Real** | `backend/app/services/dashboard_service.py` |
| Prophet / XGBoost forecasting + backtest harness | **Real** | `backend/app/forecasting/` |
| Background worker (aggregation, reservation recompute, forecast refresh) | **Real** | `backend/app/worker.py` |
| Seed-data generator | **Real** | `data/generate_seed_data.py` |
| Evaluation suite (gold answers + harness) | **Real** | `eval/` |
| Frontend (all feature pages, charts, forms, workflow UI) | **Real** | `frontend/src/features/` |
| **Keycloak** auth (JWT validation, Next.js login flow, role/scope extraction) | **Scaffold** | `backend/app/core/security.py`, `frontend/src/lib/auth.ts`, `frontend/src/middleware.ts` |
| **AI/agent** (LangGraph planner, each tool, `/agent/query` orchestration) | **Scaffold** | `backend/app/agent/` |
| **Redis** (cache/lock client, worker + API usage) | **Scaffold** | `backend/app/core/redis_client.py` |
| **Railway** deployment | **Checklist** | `RAILWAY.md` |

The RBAC *enforcement* (`require_roles`, `enforce_warehouse_scope`) is **real and tested** —
only the JWT *validation* that feeds it identity is the Keycloak scaffold (it currently
returns a hardcoded admin, or reads an `X-Debug-User` header so scoped-user behavior is
testable before Keycloak exists).

## Architecture

- **Backend** — FastAPI, thin-router / fat-service. Routers parse + scope-check + call a
  service; services own all business logic and are the only thing that touches SQLAlchemy;
  Pydantic schemas are the only thing that crosses into the API layer.
- **Frontend** — Next.js App Router, feature-based. Each `features/<domain>/` owns its
  `components/`, `actions/` (server actions), `services/` (API client calls), and `types.ts`.
  Routes in `app/` just render a feature's top-level component. Server actions call services,
  services call the shared `lib/api.ts` client.
- **Worker** — a separate long-running process against the same DB; the API writes a
  transaction and returns immediately, the worker aggregates asynchronously.

Full rationale, schema, and design decisions are in `docs/developer-guide.md`.

## Running locally

### With Docker (the intended path)

```bash
cp .env.example .env
docker compose up            # postgres, redis, keycloak, backend, worker, frontend
# in another shell, once postgres is up:
docker compose exec backend alembic upgrade head
docker compose exec backend python /app/../data/generate_seed_data.py   # or run from repo root
```

Frontend: http://localhost:3000 · Backend: http://localhost:8000 (`/docs` for OpenAPI).

### Backend without Docker

```bash
cd backend
python -m venv .venv && . .venv/Scripts/activate      # or bin/activate on POSIX
pip install -r requirements.txt
export DATABASE_URL=postgresql+psycopg://wms:wms_dev_password@localhost:5432/wms
alembic upgrade head
python ../data/generate_seed_data.py                  # run from repo root works too
uvicorn app.main:app --reload
python -m app.worker                                  # separate shell
```

The models are dialect-portable, so `DATABASE_URL=sqlite:///wl.db` works for a
quick spin-up without Postgres (create tables with
`python -c "from app.models import Base; from app.core.database import engine; Base.metadata.create_all(engine)"`
instead of Alembic, since the SQL migration targets Postgres types).

### Frontend without Docker

```bash
cd frontend
npm install
API_URL=http://localhost:8000 npm run dev             # or: npm run build && npm start
```

## Tests, evaluation, forecasting

```bash
cd backend && pytest                                  # 28 tests: workflow, RBAC scope, dashboard, worker
python eval/run_eval.py --api http://localhost:8000   # execution-success + accuracy numbers
python -m app.forecasting.backtest --folds 4 --horizon 14   # Prophet vs XGBoost vs naive baseline
```

- **Tests** cover the outbound state machine end to end (sales order → pick → pack → ship →
  deliver, plus internal transfers and the failure paths), warehouse-scope enforcement in
  both the API and the agent gate, per-warehouse reorder independence, dashboard math, and
  the worker's aggregation + reservation-healing logic.
- **Eval** scores the agent against 45 gold-answer queries. Gold values are computed by
  independent fixed SQL (not the agent's own tools), so agreement is a real check. With the
  agent scaffolded, only the RBAC-refusal cases pass — that's the honest pre-implementation
  baseline; the harness produces the real metric the moment the planner is built.
- **Backtest** is a rolling-origin comparison; the naive 28-day-mean baseline is the honesty
  check that a model has to beat.

## RBAC quick reference

Four roles: **Admin** (global), **Auditor** (global, read-only), **Warehouse Manager** and
**Procurement Officer** (read/write, scoped to assigned warehouses in
`user_warehouse_assignments`). The seed generator creates one warehouse-scoped user
(`seed-user-nairobi-mgr`, Nairobi only) so scope enforcement is demonstrable. Before
Keycloak is wired up, impersonate users in requests with a header:

```
X-Debug-User: <sub>:<username>:<role1>|<role2>
```

## Repo layout

```
warehouselens/
├── backend/        FastAPI app, models, services, agent (scaffold), forecasting, worker, tests
├── frontend/       Next.js app (feature-based)
├── data/           generate_seed_data.py
├── eval/           queries.jsonl + run_eval.py
├── docs/           developer-guide.md (the spec)
├── docker-compose.yml
├── RAILWAY.md      manual deployment checklist (learning area)
└── README.md
```
