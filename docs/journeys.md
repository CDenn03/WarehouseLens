# User Journeys

Companion to the [Developer Implementation Guide](./developer-guide.md). That document specifies schema (§5), API surface (§6), agent tools (§7), and RBAC (§9); this document threads those pieces together into the end-to-end flows a real user (or the agent, on their behalf) actually walks through.

"Journeys" isn't a term the developer guide defines — this is a synthesis, not a transcription. Each spec below cites the sections it's built from, and calls out anywhere the guide doesn't fully specify a behavior (marked **Open question**). Resolve those the same way §13 resolved earlier open questions — decide, then fold the decision back into developer-guide.md §13 and the schema/API sections so it doesn't have to be re-derived.

Each spec uses the same template: Actor, Trigger, Preconditions, Flow, Postconditions, Edge cases, RBAC.

---

## 1. Procurement Journey

**Actor:** Procurement Officer (or Admin)

**Trigger:** Stock at a warehouse needs replenishing — either a manual decision or a signal from the Inventory Query tool ("which products are below reorder point").

**Preconditions:**
- Supplier exists (or is created in this flow).
- Caller is Admin, or a Procurement Officer assigned to the PO's `destination_warehouse_id` via `user_warehouse_assignments` (§9, §13.3).

**Flow:**
1. `POST /suppliers` — create the supplier if new (Admin, Procurement Officer per §6).
2. `POST /purchase-orders` — create the PO: `supplier_id`, `destination_warehouse_id`, `order_date`, `expected_delivery_date`, plus `purchase_order_items` (`product_id`, `quantity_ordered`). Status defaults to `pending`.
3. `GET /purchase-orders?warehouse_id=&status=` — track the PO while in transit.
4. Physical goods arrive at the warehouse.
5. `POST /purchase-orders/{id}/receive` — marks the PO received, writes `inventory_transactions` rows (`type=receipt`, positive `quantity_delta`, `reference_id` = PO id) per line, updates `purchase_order_items.quantity_received`, and increments `warehouse_stock.quantity_on_hand` at `destination_warehouse_id`.

**Postconditions:**
- `purchase_orders.status = 'received'`.
- `warehouse_stock.quantity_on_hand` increased for each line item's product, at the PO's destination warehouse.
- `inventory_transactions` gains one `receipt` row per line item.

**Edge cases:**
- Cancellation before receipt (`status = 'cancelled'`) — no stock or transaction effect.
- **Resolved:** `/receive` accepts an optional per-line `items: [{product_id, quantity_received}]` payload for partial receipts; omitting the body receives everything ordered. `quantity_received` accumulates across repeated partial receives against the same PO.

**RBAC:** Admin, Procurement Officer (§6). Procurement Officer must be assigned to the destination warehouse — enforced as of developer-guide.md §13.8 (previously the role held `warehouse.global` and bypassed this check).

---

## 2. External Fulfillment Journey

**Actor:** Warehouse Manager (execution); sales order creation role unspecified — see below.

**Trigger:** A sale needs to leave a warehouse to an external customer.

**Preconditions:** `source_warehouse_id` exists; enough stock to eventually fulfill (not enforced at order creation — see edge cases).

**Flow:**
1. `POST /sales-orders` — creates `sales_orders` + `sales_order_items`, and immediately generates the linked `outbound_requests` row (`sales_order_id` set, `destination_warehouse_id = NULL` for external, `status = 'requested'`) per §13.1.
2. `POST /outbound-requests/{id}/pick-lists` — generates a `pick_lists` row (`status='open'`) and `pick_list_items` from the outbound request's line items, each optionally carrying a free-text `location` (§13.2). `outbound_requests.status` moves to `picking`.
3. `PATCH /pick-lists/{id}/items/{product_id}` — repeated per item as pickers walk the floor, recording `quantity_picked`.
4. `POST /pick-lists/{id}/complete` — closes the pick list (`status='complete'`, `completed_at` set) and reserves stock; the worker recomputes `warehouse_stock.quantity_reserved` (§8). `outbound_requests.status` moves to `packed`.
5. `POST /outbound-requests/{id}/ship` — creates the `shipments` row and moves `outbound_requests.status` to `shipped`.
6. `PATCH /shipments/{id}/deliver` — moves status to `delivered`. Because this is external (`destination_warehouse_id IS NULL`), **no** `transfer_in` transaction is written — that only applies to internal transfers (§6).

**Postconditions:** `outbound_requests.status = 'delivered'`; `shipments.status = 'delivered'` with `delivered_at` set; source warehouse stock reduced by the shipped quantity.

**Edge cases:**
- Partial picks (`quantity_picked < quantity_requested`) — no documented resolution path (short-ship? re-open pick list?).
- **Resolved:** `ship()` writes the `issue` row (developer-guide.md §13.5) — `complete_pick_list` only moves stock into `quantity_reserved`, it writes no transaction.
- **Resolved:** `POST /sales-orders` requires `outbound.sales_order.create`, granted to Admin and Warehouse Manager (developer-guide.md §13.10).

**RBAC:** Warehouse Manager scoped to `source_warehouse_id` for steps 2–6 (§9).

---

## 3. Internal Transfer Journey

**Actor:** Warehouse Manager

**Trigger:** Stock needs to move from one warehouse to another (rebalancing, not tied to a sale).

**Preconditions:** Both `source_warehouse_id` and `destination_warehouse_id` exist and are active.

**Flow:**
1. `POST /outbound-requests` — created directly with `sales_order_id = NULL`, both `source_warehouse_id` and `destination_warehouse_id` set, plus `outbound_request_items` (§13.1 — this is the documented escape hatch for transfers without a returns/fulfillment module).
2. Steps 2–5 from the External Fulfillment Journey (pick list → pick → complete → ship) apply unchanged.
3. `PATCH /shipments/{id}/deliver` — status → `delivered`. Because `destination_warehouse_id` is not null, this **does** write a `transfer_in` transaction at the destination (§6).

**Postconditions:** `warehouse_stock.quantity_on_hand` decreased at source, increased at destination; `inventory_transactions` gains a `transfer_out` row at source and a `transfer_in` row at destination.

**Edge cases:**
- **Resolved:** `create_internal_transfer` now rejects (409) if either the source or destination warehouse has `is_active = false` — closes the gap that opened up once `PATCH /warehouses/{id}` (developer-guide.md §13.6) made deactivation reachable.
- **Resolved:** `transfer_out` is written at ship time, in the same `ship()` call that writes `issue` for external fulfillment (developer-guide.md §13.5) — mirrors `transfer_in` being written at delivery.
- **Resolved:** a Warehouse Manager assigned only to the destination warehouse gets read-only visibility into the transfer before delivery — it shows up in their `GET /outbound-requests` list and `GET /outbound-requests/{id}` resolves for them. They still cannot generate a pick list, ship, or deliver it — those stay source-side only (developer-guide.md §13.11).

**RBAC:** Warehouse Manager scoped to `source_warehouse_id` for write actions (creation, picking, shipping). Read visibility is source-OR-destination (§13.11).

---

## 4. Manual Inventory Adjustment Journey

**Actor:** Warehouse Manager or Admin

**Trigger:** Cycle count mismatch, damage, shrinkage, or found stock — any correction that isn't the output of a PO receipt or a shipment.

**Preconditions:** Caller is Admin, or assigned to the `warehouse_id` being adjusted.

**Flow:**
1. `POST /inventory/transactions` — body includes `warehouse_id`, `product_id`, `quantity_delta` (signed), `type = 'adjustment'`, optional `reference_id`.
2. Backend writes the `inventory_transactions` row and updates `warehouse_stock.quantity_on_hand` by `quantity_delta`.

Note this is the one place `quantity_on_hand` changes synchronously in the request path — everywhere else (§8) reservation recompute is worker-driven, but adjustment isn't described as going through the worker.

**Postconditions:** `warehouse_stock.quantity_on_hand` reflects the corrected value; the `inventory_transactions` row is the only audit trail.

**Edge cases:**
- An adjustment can drive `quantity_on_hand` negative — no DB-level `CHECK` constraint, but `inventory_service.apply_movement` (the single choke point for all stock movement) raises a 409 if a movement would take stock below zero, so the guard exists at the application layer.
- **Resolved:** `inventory_transactions.reason` (free text) and `created_by` (Keycloak `sub`) are now populated on manual transactions (developer-guide.md §13.9). `reason` is required and must be non-blank specifically for `type='adjustment'` — the one transaction type with no PO/shipment `reference_id` to explain itself.
- **Resolved:** `POST /inventory/transactions` requires `inventory.write`, granted to Admin and Warehouse Manager (developer-guide.md §13.10).

**RBAC:** Admin, Warehouse Manager (`inventory.write` — developer-guide.md §13.10). Scope check (assigned warehouse) applies per §9's general rule regardless.

---

## 5. Warehouse & Access Administration Journey

**Actor:** Admin only

**Trigger:** Onboarding a new warehouse, or a new Warehouse Manager / Procurement Officer.

**Preconditions:** Caller has the Admin role (global, unscoped).

**Flow:**
1. `POST /warehouses` — create the warehouse (`name`, `address`, `is_active` defaults `true`).
2. Create the user in Keycloak and assign them the Warehouse Manager or Procurement Officer realm role. This step is out-of-band: the backend has no local user table beyond an optional `display_name` cache (§5, closing note) — Keycloak is the source of truth for identity and role.
3. `POST /warehouses/{id}/assignments` — inserts a `user_warehouse_assignments` row keyed on the Keycloak `sub` claim, scoping that user to this warehouse. Repeatable per user for multiple warehouses (composite PK allows it).

**Postconditions:** Warehouse is listable via `GET /warehouses`; the assigned user's subsequent requests (API and agent) are scoped to the warehouse(s) they now have rows for, enforced everywhere per §9.

**Edge cases / gaps:**
- **Resolved:** `PATCH /warehouses/{id}` now exists — accepts `name`, `address`, `is_active` (any subset), gated by a new `warehouse.update` permission (developer-guide.md §13.6).
- **Resolved:** assignment revocation already existed, just not at the path this doc guessed — it's `DELETE /iam/users/{user_id}/warehouses/{warehouse_id}` in the IAM router (alongside role revoke), not `DELETE /warehouses/{id}/assignments/{user_id}` (developer-guide.md §13.6).

**RBAC:** `warehouse.create` / `warehouse.update` / `warehouse.assign_user`, held by `admin` and `tenant_admin` in this codebase's six-role model (not a single unscoped "Admin" role — see developer-guide.md §9 for the full role list).

---

## 6. Dashboard / Reporting Journey

**Actor:** All four roles, each scope-checked per §9.

**Trigger:** User opens the dashboard, or the agent's Analytics Aggregation tool is invoked on their behalf (§7).

**Preconditions:** Valid authenticated session (JWT via the BFF cookie — see [auth-bff-pattern.md](./auth-bff-pattern.md)).

**Flow:**
1. `GET /dashboard/kpis?warehouse_id=` — 3 KPIs (§1 specifies the count but not which three — not enumerated anywhere in the guide).
2. `GET /dashboard/charts/stock-trend`
3. `GET /dashboard/charts/abc-ranking`

Per §6, omitting `warehouse_id` gives an all-warehouse rollup.

**Postconditions:** None — read-only.

**Edge cases:**
- **Resolved:** for a Warehouse Manager or Procurement Officer (scoped roles), omitting `warehouse_id` rolls up across the caller's assigned warehouses — this was already correctly implemented.
- **Resolved, and it was worse than ambiguous:** for Admin/Auditor (and, before developer-guide.md §13.8, Procurement Officer), omitting `warehouse_id` rolled up **every warehouse in the database, across every tenant** — `scope_filter_warehouse_ids` returned `None` for any `warehouse.global` holder, and the dashboard/procurement/outbound/inventory queries took that to mean "skip the filter" rather than "scope to my tenant." Fixed in developer-guide.md §13.7: the helper now always returns a concrete, tenant-scoped set of warehouse ids, so "all warehouses" for a global-scope caller means all warehouses in their tenant, never across tenants.

**RBAC:** All four roles can read. Warehouse Manager / Procurement Officer scoped to assigned warehouses (with the ambiguity above). Auditor and Admin unscoped.

---

## Cross-cutting open questions (resolved)

All four gaps below were resolved together, once the journeys were walked against the actual implementation rather than just the schema/API sections. Decisions are recorded in developer-guide.md §13 items 5-10, alongside the four already there.

1. **Which step writes the `issue` transaction** — `ship()`, not pick-list completion. §13.5.
2. **No revoke/deactivate endpoints** — deactivate (`PATCH /warehouses/{id}`) was genuinely missing and is now added; revoke already existed at `DELETE /iam/users/{user_id}/warehouses/{warehouse_id}`, just undocumented. §13.6.
3. **Missing role restrictions** on `POST /sales-orders` and `POST /inventory/transactions` — both were already correctly restricted in the implementation (Admin/Warehouse Manager); the doc just hadn't caught up. §13.10.
4. **Scoped-role dashboard rollup semantics** — correct for scoped roles; broken for global-scope roles in a way worse than "ambiguous": a real cross-tenant data leak, now fixed by making the warehouse-visibility helper always return a concrete, tenant-scoped set. Same bug shape also existed in the procurement and outbound list endpoints and is fixed there too. §13.7.

One additional decision came out of walking Journey 1 that wasn't in the original open-questions list: Procurement Officer held `warehouse.global` in the implementation, contradicting this doc's own RBAC framing and §13.3's warehouse-scoped design. Resolved in favor of the doc — the role is now scoped like Warehouse Manager. §13.8.
