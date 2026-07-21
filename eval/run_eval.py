"""Agent evaluation harness (proposal Section 6; guide Sections 10/12).

    python eval/run_eval.py [--api http://localhost:8000] [--out eval/results.json]

Scores every query in queries.jsonl on two axes:

  execution success  — the agent picked the expected tool and returned without
                       error (for scope cases: correctly refused instead).
  end-to-end accuracy — the prose answer contains the gold facts, computed here
                       by fixed SQL directly against the database. The gold
                       computation is deliberately an INDEPENDENT implementation
                       from the agent's tools: agreeing with yourself isn't a test.

Numeric matching is tolerant (values within 2% or ±1 count as present) since the
LLM rounds. Forecast golds can't be recomputed independently of the model, so
those queries score accuracy on "gave a concrete positive number for the right
SKU" rather than an exact value.

Run against seeded data. With the agent still scaffolded, expect ~0 — the point
is that the harness produces real numbers the moment the planner exists.
"""

import argparse
import json
import re
import sys
from datetime import date
from pathlib import Path

import httpx
from sqlalchemy import func, select

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.core.database import SessionLocal  # noqa: E402
from app.models import (  # noqa: E402
    OutboundRequest,
    PickList,
    PickListItem,
    Product,
    PurchaseOrder,
    SalesOrder,
    Shipment,
    Supplier,
    Warehouse,
    WarehouseStock,
)
from app.models.outbound import OutboundStatus  # noqa: E402
from app.models.procurement import POStatus  # noqa: E402


# --- gold computation (fixed SQL, independent of agent tools) ---------------

def _wh_id(db, name):
    return db.execute(select(Warehouse.id).where(Warehouse.name == name)).scalar_one()


def _stock(db, warehouse=None):
    stmt = select(WarehouseStock, Product).join(Product, Product.id == WarehouseStock.product_id)
    if warehouse:
        stmt = stmt.where(WarehouseStock.warehouse_id == _wh_id(db, warehouse))
    return db.execute(stmt).all()


def _supplier_stats(db):
    rows = db.execute(
        select(Supplier, PurchaseOrder)
        .join(PurchaseOrder, PurchaseOrder.supplier_id == Supplier.id)
        .where(PurchaseOrder.status == POStatus.RECEIVED, PurchaseOrder.actual_delivery_date.is_not(None))
    ).all()
    stats: dict[str, dict] = {}
    for supplier, po in rows:
        s = stats.setdefault(
            supplier.name,
            {"po_count": 0, "on_time": 0, "delays": [], "lead_times": [], "promised": supplier.lead_time_days},
        )
        s["po_count"] += 1
        s["lead_times"].append((po.actual_delivery_date - po.order_date).days)
        if po.expected_delivery_date:
            delay = (po.actual_delivery_date - po.expected_delivery_date).days
            if delay <= 0:
                s["on_time"] += 1
            else:
                s["delays"].append(delay)
    for s in stats.values():
        s["on_time_rate"] = s["on_time"] / s["po_count"] if s["po_count"] else None
        s["avg_delay"] = sum(s["delays"]) / len(s["delays"]) if s["delays"] else 0.0
        s["avg_lead_time"] = sum(s["lead_times"]) / len(s["lead_times"]) if s["lead_times"] else None
    return stats


def compute_gold(db, check: dict):
    """Returns a list of 'facts' the answer must contain: numbers and/or strings.
    None means accuracy can't be machine-scored for this check type."""
    t = check["type"]

    if t == "below_reorder_skus":
        skus = [p.sku for ws, p in _stock(db, check["warehouse"]) if ws.quantity_on_hand < ws.reorder_point]
        return skus or ["none"]
    if t == "below_reorder_count":
        rows = _stock(db, check.get("warehouse"))
        return [sum(1 for ws, _ in rows if ws.quantity_on_hand < ws.reorder_point)]
    if t == "on_hand":
        for ws, p in _stock(db, check["warehouse"]):
            if p.sku == check["sku"]:
                return [ws.quantity_on_hand]
        return [0]
    if t == "below_reorder_bool":
        for ws, p in _stock(db, check["warehouse"]):
            if p.sku == check["sku"]:
                return ["below" if ws.quantity_on_hand < ws.reorder_point else "not below"]
        return None
    if t == "reserved_total":
        rows = _stock(db, check["warehouse"])
        return [sum(ws.quantity_reserved for ws, _ in rows)]
    if t == "reorder_point_pair":
        facts = []
        for wh in check["warehouses"]:
            for ws, p in _stock(db, wh):
                if p.sku == check["sku"]:
                    facts.append(ws.reorder_point)
        return facts or None
    if t == "lowest_stock_skus":
        rows = sorted(_stock(db, check["warehouse"]), key=lambda r: r[0].quantity_on_hand)
        return [p.sku for _, p in rows[: check["n"]]]
    if t == "worst_supplier":
        stats = _supplier_stats(db)
        return [min(stats, key=lambda k: stats[k]["on_time_rate"] or 1.0)]
    if t == "fastest_supplier":
        stats = _supplier_stats(db)
        with_lt = {k: v for k, v in stats.items() if v["avg_lead_time"] is not None}
        return [min(with_lt, key=lambda k: with_lt[k]["avg_lead_time"])]
    if t == "avg_delay":
        return [round(_supplier_stats(db)[check["supplier"]]["avg_delay"], 1)]
    if t == "on_time_rate":
        rate = _supplier_stats(db)[check["supplier"]]["on_time_rate"]
        return [round(rate * 100)]  # answers talk in percent
    if t == "avg_lead_time":
        return [round(_supplier_stats(db)[check["supplier"]]["avg_lead_time"], 1)]
    if t == "po_count":
        return [_supplier_stats(db)[check["supplier"]]["po_count"]]
    if t == "later_than_promised":
        s = _supplier_stats(db)[check["supplier"]]
        return ["yes" if s["promised"] and s["avg_lead_time"] > s["promised"] else "no"]
    if t == "most_late_into_warehouse":
        wid = _wh_id(db, check["warehouse"])
        rows = db.execute(
            select(Supplier.name, func.count())
            .join(PurchaseOrder, PurchaseOrder.supplier_id == Supplier.id)
            .where(
                PurchaseOrder.destination_warehouse_id == wid,
                PurchaseOrder.status == POStatus.RECEIVED,
                PurchaseOrder.actual_delivery_date > PurchaseOrder.expected_delivery_date,
            )
            .group_by(Supplier.name)
            .order_by(func.count().desc())
        ).first()
        return [rows[0]] if rows else None
    if t == "total_value":
        rows = _stock(db, check.get("warehouse"))
        return [round(float(sum(ws.quantity_on_hand * p.unit_cost for ws, p in rows)))]
    if t == "value_compare" or t == "richest_warehouse":
        names = check.get("warehouses") or [w.name for w in db.execute(select(Warehouse)).scalars()]
        values = {
            name: round(float(sum(ws.quantity_on_hand * p.unit_cost for ws, p in _stock(db, name))))
            for name in names
        }
        if t == "richest_warehouse":
            return [max(values, key=values.get)]
        return list(values.values())
    if t == "open_outbound_count":
        stmt = select(func.count()).select_from(OutboundRequest).where(
            OutboundRequest.status.in_(OutboundStatus.OPEN)
        )
        if check.get("warehouse"):
            stmt = stmt.where(OutboundRequest.source_warehouse_id == _wh_id(db, check["warehouse"]))
        return [db.execute(stmt).scalar_one()]
    if t == "status_count":
        return [
            db.execute(
                select(func.count()).select_from(OutboundRequest).where(
                    OutboundRequest.status == check["status"]
                )
            ).scalar_one()
        ]
    if t == "requests_in_status":
        stmt = select(func.count()).select_from(OutboundRequest).where(
            OutboundRequest.status == check["status"]
        )
        if check.get("warehouse"):
            stmt = stmt.where(OutboundRequest.source_warehouse_id == _wh_id(db, check["warehouse"]))
        return [db.execute(stmt).scalar_one()]
    if t == "internal_transfer_statuses":
        rows = db.execute(
            select(OutboundRequest.status).where(OutboundRequest.destination_warehouse_id.is_not(None))
        ).scalars()
        return list(set(rows)) or ["none"]
    if t == "pick_list_locations":
        wid = _wh_id(db, check["warehouse"])
        rows = db.execute(
            select(PickListItem.location)
            .join(PickList, PickList.id == PickListItem.pick_list_id)
            .join(OutboundRequest, OutboundRequest.id == PickList.outbound_request_id)
            .where(OutboundRequest.source_warehouse_id == wid, PickListItem.location.is_not(None))
        ).scalars()
        return list(set(rows)) or None
    if t == "customer_request_status":
        row = db.execute(
            select(OutboundRequest.status)
            .join(SalesOrder, SalesOrder.id == OutboundRequest.sales_order_id)
            .where(SalesOrder.customer_name == check["customer"])
        ).scalar_one_or_none()
        return [row] if row else None
    if t == "shipment_tracking":
        wid = _wh_id(db, check["warehouse"])
        row = db.execute(
            select(Shipment.carrier, Shipment.tracking_number)
            .join(OutboundRequest, OutboundRequest.id == Shipment.outbound_request_id)
            .where(OutboundRequest.source_warehouse_id == wid)
        ).first()
        return [row[0], row[1]] if row else None

    # forecast_*, report_mentions_kpis, refusal*: not machine-computable here
    return None


# --- answer matching ---------------------------------------------------------

def fact_in_answer(fact, answer: str) -> bool:
    if isinstance(fact, str):
        return fact.lower() in answer.lower()
    value = float(fact)
    for m in re.findall(r"-?\d[\d,]*\.?\d*", answer):
        try:
            candidate = float(m.replace(",", ""))
        except ValueError:
            continue
        if abs(candidate - value) <= max(1.0, abs(value) * 0.02):
            return True
    return False


REFUSAL_MARKERS = ("not assigned", "not authorized", "permission", "access", "forbidden", "scope")


def score_case(case: dict, response: httpx.Response, gold) -> dict:
    check_type = case["check"]["type"]
    body = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
    answer = (body.get("answer") or body.get("detail") or "") if isinstance(body, dict) else ""
    tool_used = body.get("tool_used") if isinstance(body, dict) else None

    if case.get("expect_refusal") or check_type in ("refusal", "refusal_or_scoped"):
        refused = response.status_code == 403 or any(m in answer.lower() for m in REFUSAL_MARKERS)
        return {"execution_success": refused, "accuracy": refused}

    execution = response.status_code == 200 and tool_used == case["expected_tool"]

    if check_type.startswith("forecast_"):
        accuracy = execution and bool(re.search(r"\d", answer))
    elif check_type == "report_mentions_kpis":
        accuracy = execution and all(k in answer.lower() for k in ("value", "outbound"))
    elif gold is None:
        accuracy = None  # unscorable — excluded from the accuracy denominator
    else:
        accuracy = execution and all(fact_in_answer(f, answer) for f in gold)
    return {"execution_success": execution, "accuracy": accuracy}


# --- main ---------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api", default="http://localhost:8000")
    parser.add_argument("--out", default=str(Path(__file__).parent / "results.json"))
    args = parser.parse_args()

    queries = [
        json.loads(line)
        for line in Path(__file__).with_name("queries.jsonl").read_text().splitlines()
        if line.strip()
    ]

    results = []
    with SessionLocal() as db, httpx.Client(base_url=args.api, timeout=120) as client:
        wh_ids = {w.name: str(w.id) for w in db.execute(select(Warehouse)).scalars()}
        for case in queries:
            gold = compute_gold(db, case["check"])
            headers = {"X-Debug-User": case["as_user"]} if case.get("as_user") else {}
            payload = {
                "question": case["question"],
                "warehouse_id": wh_ids.get(case["warehouse"]) if case.get("warehouse") else None,
            }
            try:
                response = client.post("/api/v1/agent/query", json=payload, headers=headers)
                scores = score_case(case, response, gold)
            except httpx.HTTPError as exc:
                scores = {"execution_success": False, "accuracy": False, "error": str(exc)}
            results.append({**case, "gold": gold, **scores})
            mark = "PASS" if scores["execution_success"] else "FAIL"
            print(f"  {mark} {case['id']}: exec={scores['execution_success']} acc={scores['accuracy']}")

    executed = sum(1 for r in results if r["execution_success"])
    scorable = [r for r in results if r["accuracy"] is not None]
    accurate = sum(1 for r in results if r["accuracy"])
    print(f"\nExecution success: {executed}/{len(results)} ({executed / len(results):.0%})")
    if scorable:
        print(f"End-to-end accuracy: {accurate}/{len(scorable)} ({accurate / len(scorable):.0%})")

    by_tool: dict[str, list] = {}
    for r in results:
        by_tool.setdefault(r["expected_tool"], []).append(r)
    for tool, cases in sorted(by_tool.items()):
        ok = sum(1 for c in cases if c["execution_success"])
        print(f"  {tool}: {ok}/{len(cases)} executed")

    Path(args.out).write_text(
        json.dumps({"run_date": date.today().isoformat(), "results": results}, indent=2, default=str)
    )
    print(f"\nWrote {args.out}")


if __name__ == "__main__":
    main()
