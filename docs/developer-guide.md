# WarehouseLens — Developer Implementation Guide

Companion to the capstone/thesis proposal. That document argues the case to an advisor; this one tells a developer (you) what to actually build. Keep them in sync as the design evolves — right now this doc goes further than the proposal on multi-warehouse support and the picking/packing/shipping workflow, since those were added after the proposal's System Design and Timeline sections were drafted.

## 1. Scope Recap

**In scope this term**
- Inventory + Procurement core (products, suppliers, purchase orders)
- Multi-warehouse support — stock, purchase orders, and outbound shipments are tracked per warehouse, including per-warehouse reorder points (Section 13.4)
- A minimal sales-order stub (order + line items, no status machine) whose sole job is to trigger an outbound request (Section 13.1) — not a fulfillment module
- A free-text `location` field on pick list items (Section 13.2) — not a bins/zones model
- A picking → packing → shipping workflow for outbound stock movement
- Keycloak auth with four roles (Admin, Warehouse Manager, Procurement Officer, Auditor), with Warehouse Manager and Procurement Officer scoped to assigned warehouses (Section 13.3)
- A minimal dashboard (3 KPIs, 2 chart types)
- The AI copilot: planner + tool-routing agent over the tools in Section 7
- One demand-forecasting model (Prophet, benchmarked against XGBoost)
- A background worker for analytics aggregation and forecast refresh
- The evaluation suite described in the proposal (Section 6)

**Still explicitly out of scope**
- Bin/location-level tracking as a real module — no bins, zones, or capacity model. The `location` field above is a free-text string, not a structured location entity.
- Order fulfillment / sales order management as a real module — no order status machine, customer accounts, or fulfillment tracking beyond the outbound request it triggers.
- Returns and internal transfers *as their own modules* — internal transfers can still be created directly against `outbound_requests` (nullable `sales_order_id`), just without a returns workflow around them.
- Stock-out prediction, anomaly detection, supplier risk prediction as separate ML models
- The rest of the original KPI/chart list
- Comprehensive audit logging / a general policy engine
- Multi-model evaluation

Section 13 records why each of these landed where it did — read it once, you shouldn't need to revisit these mid-build.

## 2. Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js, TypeScript, Tailwind CSS |
| Backend | FastAPI, SQLAlchemy, Pydantic |
| Database | PostgreSQL |
| Auth | Keycloak (OAuth2 / OIDC) |
| Cache / job queue | Redis |
| Agent orchestration | LangGraph (pick one — see the proposal's stack notes; don't leave this open in practice) |
| Forecasting | Prophet (primary), XGBoost (comparison) |
| Infra (local) | Docker Compose, GitHub Actions |
| Infra (deployed) | Railway (frontend, backend, worker, Keycloak, Redis) + Neon (managed Postgres) — see Section 11 |

## 3. Repository Structure

```
warehouselens/
├── backend/
│   ├── app/
│   │   ├── api/                # FastAPI routers, one file per resource
│   │   ├── models/              # SQLAlchemy models
│   │   ├── schemas/             # Pydantic request/response schemas
│   │   ├── agent/
│   │   │   ├── planner.py
│   │   │   └── tools/           # one file per tool, see Section 7
│   │   ├── forecasting/
│   │   ├── worker.py             # background worker entrypoint
│   │   └── main.py
│   ├── migrations/               # Alembic
│   └── tests/
├── frontend/
│   └── (standard Next.js app router layout)
├── eval/
│   ├── queries.jsonl              # the 40-50 gold-answer test set from the proposal
│   └── run_eval.py
├── data/
│   └── generate_seed_data.py      # synthetic data generator
├── docker-compose.yml
└── docs/
    ├── proposal.docx
    └── developer-guide.md          # this file
```

## 4. Local Environment Setup

This `docker-compose.yml` is for local dev only — see Section 11 for how these same five services map onto the deployed environment (Railway + Neon). Don't add production secrets here; the hardcoded passwords below are dev-only by design.

```yaml
# docker-compose.yml
version: "3.9"
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: wms
      POSTGRES_USER: wms
      POSTGRES_PASSWORD: wms_dev_password
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]

  redis:
    image: redis:7
    ports: ["6379:6379"]

  keycloak:
    image: quay.io/keycloak/keycloak:25.0
    command: start-dev
    environment:
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: admin
    ports: ["8080:8080"]

  backend:
    build: ./backend
    env_file: .env
    depends_on: [postgres, redis, keycloak]
    ports: ["8000:8000"]

  worker:
    build: ./backend
    command: python -m app.worker
    env_file: .env
    depends_on: [postgres, redis]

  frontend:
    build: ./frontend
    env_file: .env
    depends_on: [backend]
    ports: ["3000:3000"]

volumes:
  pgdata:
```

Minimum `.env` variables: `DATABASE_URL`, `REDIS_URL`, `KEYCLOAK_ISSUER_URL`, `KEYCLOAK_CLIENT_ID`, `LLM_API_KEY`, `LLM_MODEL`.

Bring the stack up with `docker compose up`, run Alembic migrations, then `python data/generate_seed_data.py` before touching the agent — nothing it says is meaningful against an empty database.

## 5. Database Schema

```sql
-- Warehouses (new)
CREATE TABLE warehouses (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name             VARCHAR(120) NOT NULL,
    address          VARCHAR(255),
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Product catalog (global, not warehouse-specific)
CREATE TABLE products (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku              VARCHAR(64) UNIQUE NOT NULL,
    name             VARCHAR(200) NOT NULL,
    category         VARCHAR(100),
    unit_cost        NUMERIC(12,2) NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-warehouse stock — this table is what makes multi-warehouse support real
CREATE TABLE warehouse_stock (
    warehouse_id      UUID NOT NULL REFERENCES warehouses(id),
    product_id        UUID NOT NULL REFERENCES products(id),
    quantity_on_hand  INTEGER NOT NULL DEFAULT 0,
    quantity_reserved INTEGER NOT NULL DEFAULT 0,   -- reserved by open pick lists
    reorder_point     INTEGER NOT NULL DEFAULT 0,   -- per-warehouse threshold, moved off products; see Section 13.4
    PRIMARY KEY (warehouse_id, product_id)
);

CREATE TABLE suppliers (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name             VARCHAR(200) NOT NULL,
    lead_time_days   INTEGER,
    contact_email    VARCHAR(200),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Inbound
CREATE TABLE purchase_orders (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id              UUID NOT NULL REFERENCES suppliers(id),
    destination_warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    status                   VARCHAR(30) NOT NULL DEFAULT 'pending', -- pending, confirmed, received, cancelled
    order_date               DATE NOT NULL,
    expected_delivery_date   DATE,
    actual_delivery_date     DATE,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE purchase_order_items (
    purchase_order_id  UUID NOT NULL REFERENCES purchase_orders(id),
    product_id         UUID NOT NULL REFERENCES products(id),
    quantity_ordered   INTEGER NOT NULL,
    quantity_received  INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (purchase_order_id, product_id)
);

-- Source of truth for all stock movement; also the forecasting model's input
CREATE TABLE inventory_transactions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id    UUID NOT NULL REFERENCES warehouses(id),
    product_id      UUID NOT NULL REFERENCES products(id),
    quantity_delta  INTEGER NOT NULL,        -- positive = receipt, negative = issue
    type            VARCHAR(30) NOT NULL,    -- receipt | issue | adjustment | transfer_out | transfer_in
    reference_id    UUID,                    -- optional FK to a PO, shipment, etc.
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sales orders (new, minimal stub) — the trigger for external outbound_requests; see Section 13.1.
-- No status machine here on purpose: once created, the linked outbound_request's own
-- status (below) is the single source of truth for what's happened since.
CREATE TABLE sales_orders (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_warehouse_id   UUID NOT NULL REFERENCES warehouses(id),
    customer_name         VARCHAR(200),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sales_order_items (
    sales_order_id     UUID NOT NULL REFERENCES sales_orders(id),
    product_id         UUID NOT NULL REFERENCES products(id),
    quantity_ordered   INTEGER NOT NULL,
    PRIMARY KEY (sales_order_id, product_id)
);

-- Outbound (new) — see Section 13 for what this entity does and doesn't assume
CREATE TABLE outbound_requests (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_order_id            UUID REFERENCES sales_orders(id),  -- NULL = internal transfer, created directly
    source_warehouse_id       UUID NOT NULL REFERENCES warehouses(id),
    destination_warehouse_id  UUID REFERENCES warehouses(id),  -- NULL = external destination
    status                    VARCHAR(30) NOT NULL DEFAULT 'requested', -- requested, picking, packed, shipped, delivered, cancelled
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE outbound_request_items (
    outbound_request_id  UUID NOT NULL REFERENCES outbound_requests(id),
    product_id           UUID NOT NULL REFERENCES products(id),
    quantity_requested   INTEGER NOT NULL,
    PRIMARY KEY (outbound_request_id, product_id)
);

CREATE TABLE pick_lists (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outbound_request_id  UUID NOT NULL REFERENCES outbound_requests(id),
    status               VARCHAR(30) NOT NULL DEFAULT 'open',  -- open, in_progress, complete
    assigned_to          VARCHAR(120),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at         TIMESTAMPTZ
);

CREATE TABLE pick_list_items (
    pick_list_id         UUID NOT NULL REFERENCES pick_lists(id),
    product_id            UUID NOT NULL REFERENCES products(id),
    quantity_requested    INTEGER NOT NULL,
    quantity_picked        INTEGER NOT NULL DEFAULT 0,
    location               VARCHAR(60),  -- free text, e.g. "Aisle 4B" — not a bins/zones model; see Section 13.2
    PRIMARY KEY (pick_list_id, product_id)
);

CREATE TABLE shipments (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outbound_request_id  UUID NOT NULL REFERENCES outbound_requests(id),
    carrier              VARCHAR(100),
    tracking_number      VARCHAR(120),
    status               VARCHAR(30) NOT NULL DEFAULT 'packed', -- packed, shipped, delivered
    packed_at            TIMESTAMPTZ,
    shipped_at           TIMESTAMPTZ,
    delivered_at         TIMESTAMPTZ
);

-- RBAC scoping (new) — restricts Warehouse Manager / Procurement Officer to assigned
-- warehouses; Admin and Auditor stay global and never appear in this table. See Section 13.3.
CREATE TABLE user_warehouse_assignments (
    user_id       VARCHAR(120) NOT NULL,  -- Keycloak subject (JWT `sub` claim), not a local FK
    warehouse_id  UUID NOT NULL REFERENCES warehouses(id),
    PRIMARY KEY (user_id, warehouse_id)
);
```

Users and roles live in Keycloak, not in this schema — the backend trusts the JWT it receives and doesn't maintain its own user table beyond an optional `display_name` cache if the UI needs one. `user_warehouse_assignments` is the one exception: Keycloak has no concept of per-resource scoping, so warehouse assignment lives in Postgres, keyed off the JWT's `sub` claim.

## 6. API Surface

| Method | Path | Notes |
|---|---|---|
| GET | `/warehouses` | List warehouses |
| POST | `/warehouses` | Admin only |
| POST | `/warehouses/{id}/assignments` | Admin only — assigns a Warehouse Manager / Procurement Officer to this warehouse (Section 13.3) |
| GET | `/products` | List/search catalog |
| POST | `/products` | Admin, Procurement Officer |
| GET | `/products/{id}/stock` | Per-warehouse stock breakdown for one product |
| GET | `/inventory/transactions` | Filter by `warehouse_id`, `product_id`, date range |
| POST | `/inventory/transactions` | Manual adjustment |
| GET | `/suppliers` | List suppliers |
| POST | `/suppliers` | Admin, Procurement Officer |
| GET | `/purchase-orders` | Filter by warehouse, status |
| POST | `/purchase-orders` | Create a PO |
| POST | `/purchase-orders/{id}/receive` | Marks received, writes inventory transactions |
| POST | `/sales-orders` | Creates a sales order + line items, immediately generates the linked `outbound_request` (Section 13.1) |
| POST | `/outbound-requests` | Create an outbound request directly — internal transfers only; external shipments go through `/sales-orders` |
| POST | `/outbound-requests/{id}/pick-lists` | Generate a pick list from the request; items carry an optional free-text `location` (Section 13.2) |
| PATCH | `/pick-lists/{id}/items/{product_id}` | Record quantity picked |
| POST | `/pick-lists/{id}/complete` | Closes the pick list, reserves stock for packing |
| POST | `/outbound-requests/{id}/ship` | Creates the shipment record, status → shipped |
| PATCH | `/shipments/{id}/deliver` | Status → delivered, writes `transfer_in` transaction if internal |
| GET | `/dashboard/kpis` | `?warehouse_id=` optional; omit for all-warehouse rollup |
| GET | `/dashboard/charts/stock-trend` | |
| GET | `/dashboard/charts/abc-ranking` | |
| POST | `/agent/query` | `{ "question": str, "warehouse_id": str \| null }` → the copilot |
| GET | `/forecast/{product_id}` | `?warehouse_id=&horizon=` |

## 7. Agent Architecture & Tools

Same principle as the proposal: the planner never generates SQL. It picks a tool, the tool runs a fixed, parameterized query, the result comes back structured, and the LLM turns that into prose. Two of the original tools now take an optional `warehouse_id`; one tool is new to cover the outbound workflow.

| Tool | Function | Example query |
|---|---|---|
| Inventory Query | Stock levels, reorder status, expiry — filterable by warehouse | "Which products are below reorder point in the Nairobi warehouse?" |
| Supplier Performance | Lead time / on-time delivery stats from PO history | "Which supplier has the most delivery delays this quarter?" |
| Forecast | Wraps the trained demand model for a product + horizon | "What's the projected demand for SKU-1042 over the next 4 weeks?" |
| Analytics Aggregation | Dashboard KPIs, optionally scoped to one warehouse | "What's our total inventory value across all warehouses?" |
| **Outbound Status** *(new)* | Status of outbound requests, pick lists, and shipments | "What's still in picking for the Mombasa warehouse?" |
| Report Synthesis *(stretch)* | Combines other tools into a narrative summary | "Summarize this week's warehouse performance." |

Reference shape for a tool implementation:

```python
# app/agent/tools/inventory_query.py
from pydantic import BaseModel
from sqlalchemy.orm import Session

class InventoryQueryInput(BaseModel):
    warehouse_id: str | None = None
    below_reorder_point: bool = False
    product_sku: str | None = None

def inventory_query_tool(input: InventoryQueryInput, db: Session) -> dict:
    """The planner supplies structured arguments; this function is the only
    thing that touches the database. No LLM-generated SQL, ever."""
    query = db.query(WarehouseStock).join(Product)
    if input.warehouse_id:
        query = query.filter(WarehouseStock.warehouse_id == input.warehouse_id)
    if input.below_reorder_point:
        # reorder_point lives on warehouse_stock now, not products — Section 13.4
        query = query.filter(WarehouseStock.quantity_on_hand < WarehouseStock.reorder_point)
    if input.product_sku:
        query = query.filter(Product.sku == input.product_sku)
    return {"results": [serialize(r) for r in query.all()]}
```

## 8. Background Worker

- Aggregates `inventory_transactions` into analytics tables on a schedule (start with every 5–15 minutes; no need for real-time streaming at this scale).
- Recomputes the demand forecast per product on the same or a slower cadence.
- Recalculates `warehouse_stock.quantity_reserved` when pick lists open/close.
- Everything here is decoupled from the request path — the API writes a transaction and returns immediately; the worker catches up asynchronously. This is the project's one legitimate distributed-systems component (see the proposal, Section 4.4).

## 9. Auth & RBAC

Four roles, enforced by the backend after Keycloak validates the JWT: **Admin** (full access, all warehouses), **Warehouse Manager** and **Procurement Officer** (read/write within their domain, scoped to warehouses in `user_warehouse_assignments` — Section 13.3), **Auditor** (read-only, everywhere, unscoped). The agent applies the same role *and* warehouse-scope check before executing a tool and before returning a result — it should never be able to answer with data the requesting user couldn't query directly, including data from a warehouse they're not assigned to.

Every endpoint and tool that filters by `warehouse_id` needs the scope check added at the same time it's built, not bolted on after — this touches every permission check in the API and the agent, so treat it as part of Phase 1/2, not a later pass (Section 10).

## 10. Build Order

Sequenced so the parts your evaluation plan actually measures get built and tested before the parts that don't have a metric attached. If the term runs short, later phases are what should slip — not the agent evaluation.

1. **Weeks 1-2 — Foundation.** Schema + Alembic migrations — including `reorder_point` on `warehouse_stock` (Section 13.4) and the `user_warehouse_assignments` table (Section 13.3) from the start, not retrofitted. `docker compose up` working end to end, synthetic seed-data generator producing products/suppliers/POs/transactions for at least 2 warehouses, with per-warehouse reorder thresholds that actually differ.
2. **Weeks 3-5 — Agent core.** Planner + tool-selection logic; Inventory Query and Supplier Performance tools working end to end against seed data, with the warehouse-scope check (Section 9) enforced from the first tool, not added later. No outbound workflow yet.
3. **Weeks 6-7 — Forecasting.** Prophet + XGBoost comparison, backtest harness, Forecast tool wired into the agent.
4. **Weeks 8-9 — Evaluation.** Build the 40-50 query gold-answer set, run it, get real execution-success and end-to-end accuracy numbers against both baselines. This is the deliverable the proposal's contribution claim depends on — don't move on until it produces numbers.
5. **Weeks 10+ — Outbound workflow and multi-warehouse polish.** The sales-order stub (Section 13.1) → `outbound_requests` → pick lists (with the free-text `location` field, Section 13.2) → shipments, the Outbound Status tool, warehouse-scoped dashboard views. Treat this phase as time-boxed: if it eats into Phase 4's time, cut the dashboard chart types before cutting the evaluation.
6. **Final weeks — Write-up and defense prep.**

## 11. Deployment

No VPS — the deployed environment is Railway (frontend, backend, worker, Keycloak, Redis, one project, private network) plus Neon for managed Postgres. Do this after Phase 1 (Section 10) so you're not debugging deploy issues and schema issues at the same time; don't wait until the end of the term to try it once.

**Service mapping**

| Local (Compose) | Deployed | Notes |
|---|---|---|
| `postgres` | Neon | Pooled (PgBouncer) connection string for the app, not the direct one — Railway services restart independently and will exhaust Neon's direct connection limit otherwise |
| `redis` | Railway Redis plugin | Managed, no config changes needed |
| `keycloak` | Railway service, same image | Mode changes — see below |
| `backend` | Railway service | Same Dockerfile |
| `worker` | Railway service, same image as backend | Command overridden to `python -m app.worker`; independent restart policy |
| `frontend` | Railway service | The only service with a public domain |

**Steps**

1. **Provision Neon first.** Create the project, grab both connection strings, run Alembic migrations against it once from your local machine before deploying anything else.
2. **Create the Railway project from the repo.** Point backend, worker, and frontend at the same repo with different root/start commands. Add Keycloak (same `quay.io/keycloak/keycloak` image) and Redis (Railway's managed plugin) as their own services.
3. **Move secrets to Railway's variable store**, scoped per service — `POSTGRES_PASSWORD` and `KEYCLOAK_ADMIN_PASSWORD` no longer live in a committed file. `DATABASE_URL` now points at Neon. `REDIS_URL`, `KEYCLOAK_ISSUER_URL`, `KEYCLOAK_CLIENT_ID`, `LLM_API_KEY` carry over as Railway variables instead of `.env`.
4. **Switch Keycloak out of dev mode.** `start-dev` → `start --optimized`. Set `KC_HOSTNAME` to the Railway-issued domain. Give Keycloak its own database on the same Neon project (a second database, not a shared schema) — keeps the app's data resettable/reseedable without touching the Keycloak realm config.
5. **Expose only the frontend publicly.** Backend, worker, Keycloak, and Redis stay on Railway's private network (`service-name.railway.internal`) — the frontend calls the backend internally, not over a public URL.
6. **Add a startup healthcheck gate for Keycloak** (`/health/ready`). Locally `depends_on` only waits for container start, not readiness; Keycloak is the slowest service to boot, so the backend needs to retry on connection failure rather than crash-loop on first deploy.

**Not doing:** serverless (Lambda/Cloud Run) for the backend or worker — the worker is a long-running polling process (Section 8) and Keycloak is a stateful JVM app, neither of which fits a scale-to-zero function model without a rewrite that isn't worth it for this project. Not swapping Keycloak for a hosted auth provider either — it's already load-bearing for the four-role RBAC model in Section 9, and replacing it now would be a scope increase, not a deployment change.

## 12. Testing Notes

- Seed data should include at least one product per warehouse that's deliberately below reorder point, one supplier with a bad on-time record, and one outbound request in each status — otherwise half the tools have nothing interesting to say and the evaluation set can't exercise them.
- Since `reorder_point` is now per-warehouse, seed data needs at least one product with a *different* threshold in two different warehouses — otherwise a bug that silently reads a global value instead of the warehouse-scoped one won't show up in testing.
- Seed at least one user assigned to a single warehouse via `user_warehouse_assignments` and confirm both the API and the agent refuse to return data for a warehouse that user isn't assigned to — this is a correctness bug if missed, not a cosmetic one.
- Seed at least one sales order that generates an outbound request end to end, and at least one pick list item with a `location` value set, so the Outbound Status tool has something real to describe.
- The evaluation query set (Section 6.1 of the proposal) should get a handful of new entries once the Outbound Status tool exists — don't let the gold-answer set go stale relative to what the agent can actually do.

## 13. Design Decisions (resolved)

These were open questions in earlier drafts. Decisions below are final for this term — the schema, API, and Build Order sections above already reflect them. Recorded here so the reasoning doesn't get lost.

1. **What triggers a pick list?** Resolved: a minimal sales-order stub (`sales_orders` + `sales_order_items`), not the full Order Fulfillment module. It has no status machine of its own — creating a sales order immediately generates the linked `outbound_request`, and from that point the outbound request's own status is the single source of truth. `outbound_requests.sales_order_id` is nullable so internal transfers can still be created directly, without a sales order, exactly as before. Order Fulfillment as a real module (customer accounts, order status tracking, etc.) stays out of scope — this is its thinnest possible trigger, not a reopening of that scope item.
2. **Is picking bin-level?** Resolved: no bin/zone/capacity model. Instead, `pick_list_items` gets a free-text `location` column (e.g. `"Aisle 4B"`) — enough for a picker to be told roughly where to look, without building the bin-tracking module. If a real bins/zones/capacity system becomes a requirement later, that's a genuine scope increase, not a schema tweak.
3. **Is RBAC warehouse-scoped?** Resolved: yes. `user_warehouse_assignments` maps a Keycloak user (`sub` claim) to the warehouses they can act on. Admin and Auditor stay global and never appear in this table — only Warehouse Manager and Procurement Officer are checked against it. Because this touches every permission check in the API and the agent, it's built into the schema and enforcement from Phase 1/2 (Section 10), not retrofitted after tools already exist.
4. **Is reorder point per-warehouse?** Resolved: yes. `reorder_point` moved from `products` to `warehouse_stock`. This keeps it consistent with everything else that's already warehouse-scoped — the demand forecast is computed per warehouse, and the Inventory Query tool answers per-warehouse questions, so a global reorder threshold would have quietly been wrong the first time two warehouses had different demand patterns for the same product.
