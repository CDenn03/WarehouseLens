"""Agent tool + planner tests.

Tool functions are called directly (no LLM involved at all) for the bulk of
this coverage — per agent-core-spec.md §6, that's cheaper and faster than the
eval harness for catching regressions. A handful of HTTP-level tests mock
ChatAnthropic to exercise the planner graph end to end, including the
scope-injection rule (agent-core-spec.md §4.5) — no real network/LLM call is
ever made in these tests.
"""

from datetime import date
from unittest.mock import patch

import pytest

from app.agent.tools.analytics_aggregation import (
    AnalyticsAggregationInput,
    analytics_aggregation_tool,
)
from app.agent.tools.forecast import ForecastToolInput, forecast_tool
from app.agent.tools.inventory_query import InventoryQueryInput, inventory_query_tool
from app.agent.tools.outbound_status import OutboundStatusInput, outbound_status_tool
from app.agent.tools.report_synthesis import ReportSynthesisInput, report_synthesis_tool
from app.agent.tools.supplier_performance import (
    SupplierPerformanceInput,
    supplier_performance_tool,
)
from app.core.exceptions import ForbiddenError, NotFoundError
from app.core.security import CurrentUser
from app.models import OutboundRequest, OutboundRequestItem, PurchaseOrder, PurchaseOrderItem, User, UserTenant
from app.models.authorization import UserRole
from app.models.procurement import POStatus
from app.models.warehouse import UserWarehouseAssignment
from tests.conftest import ADMIN, ADMIN_USER, NAIROBI_MANAGER, NAIROBI_MANAGER_USER


def _admin_user(seeded) -> CurrentUser:
    return CurrentUser(sub=ADMIN_USER, username="admin", tenant_id=seeded["tenant"].id)


def _nairobi_manager(seeded) -> CurrentUser:
    return CurrentUser(sub=NAIROBI_MANAGER_USER, username="nai.manager", tenant_id=seeded["tenant"].id)


# --- Inventory Query ---------------------------------------------------------


def test_inventory_query_below_reorder(db_session, seeded):
    result = inventory_query_tool(
        InventoryQueryInput(below_reorder_point=True), db_session, _admin_user(seeded)
    )
    nairobi_rows = [r for r in result["results"] if r["warehouse_name"] == "Nairobi Central"]
    assert any(r["sku"] == seeded["widget"].sku for r in nairobi_rows)
    assert all(r["quantity_on_hand"] < r["reorder_point"] for r in result["results"])


def test_inventory_query_scoped_user_only_sees_assigned_warehouse(db_session, seeded):
    result = inventory_query_tool(InventoryQueryInput(), db_session, _nairobi_manager(seeded))
    assert {r["warehouse_name"] for r in result["results"]} == {"Nairobi Central"}


def test_inventory_query_rejects_foreign_warehouse(db_session, seeded):
    with pytest.raises(ForbiddenError):
        inventory_query_tool(
            InventoryQueryInput(warehouse_id=str(seeded["mombasa"].id)),
            db_session,
            _nairobi_manager(seeded),
        )


# --- Supplier Performance -----------------------------------------------------


def test_supplier_performance_reports_on_time_rate(db_session, seeded):
    po = PurchaseOrder(
        supplier_id=seeded["supplier"].id,
        destination_warehouse_id=seeded["nairobi"].id,
        status=POStatus.RECEIVED,
        order_date=date(2026, 1, 1),
        expected_delivery_date=date(2026, 1, 10),
        actual_delivery_date=date(2026, 1, 12),
        items=[
            PurchaseOrderItem(
                product_id=seeded["widget"].id, quantity_ordered=10, quantity_received=10
            )
        ],
    )
    db_session.add(po)
    db_session.commit()

    result = supplier_performance_tool(
        SupplierPerformanceInput(), db_session, _admin_user(seeded)
    )
    acme = next(s for s in result["suppliers"] if s["name"] == "Acme")
    assert acme["po_count"] == 1
    assert acme["late_po_count"] == 1
    assert acme["on_time_rate_percent"] == 0


def test_supplier_performance_scoped_to_warehouse(db_session, seeded):
    for warehouse_id, delivered_late in [(seeded["nairobi"].id, True), (seeded["mombasa"].id, False)]:
        db_session.add(
            PurchaseOrder(
                supplier_id=seeded["supplier"].id,
                destination_warehouse_id=warehouse_id,
                status=POStatus.RECEIVED,
                order_date=date(2026, 1, 1),
                expected_delivery_date=date(2026, 1, 5),
                actual_delivery_date=date(2026, 1, 10) if delivered_late else date(2026, 1, 4),
                items=[
                    PurchaseOrderItem(
                        product_id=seeded["widget"].id, quantity_ordered=5, quantity_received=5
                    )
                ],
            )
        )
    db_session.commit()

    result = supplier_performance_tool(
        SupplierPerformanceInput(warehouse_id=str(seeded["mombasa"].id)),
        db_session,
        _admin_user(seeded),
    )
    acme = next(s for s in result["suppliers"] if s["name"] == "Acme")
    assert acme["po_count"] == 1
    assert acme["late_po_count"] == 0


# --- Outbound Status ----------------------------------------------------------


def test_outbound_status_lists_requests(db_session, seeded):
    request = OutboundRequest(
        source_warehouse_id=seeded["nairobi"].id,
        destination_warehouse_id=None,
        status="requested",
        items=[OutboundRequestItem(product_id=seeded["gadget"].id, quantity_requested=5)],
    )
    db_session.add(request)
    db_session.commit()

    result = outbound_status_tool(
        OutboundStatusInput(status="requested"), db_session, _admin_user(seeded)
    )
    assert any(r["id"] == str(request.id) for r in result["requests"])


def test_outbound_status_shows_inbound_transfer_to_destination_manager(db_session, seeded):
    """developer-guide.md §13.11: read visibility is source-OR-destination."""
    request = OutboundRequest(
        source_warehouse_id=seeded["nairobi"].id,
        destination_warehouse_id=seeded["mombasa"].id,
        status="requested",
        items=[OutboundRequestItem(product_id=seeded["gadget"].id, quantity_requested=5)],
    )
    db_session.add(request)

    mombasa_user = "sub-mombasa-mgr-agent-test"
    db_session.add(User(id=mombasa_user, email=f"{mombasa_user}@test.local", username=mombasa_user))
    db_session.add(UserTenant(user_id=mombasa_user, tenant_id=seeded["tenant"].id))
    db_session.add(
        UserRole(
            user_id=mombasa_user,
            role_id=seeded["roles"]["warehouse_manager"].id,
            tenant_id=seeded["tenant"].id,
        )
    )
    db_session.add(UserWarehouseAssignment(user_id=mombasa_user, warehouse_id=seeded["mombasa"].id))
    db_session.commit()

    user = CurrentUser(sub=mombasa_user, username="mombasa.mgr", tenant_id=seeded["tenant"].id)
    result = outbound_status_tool(OutboundStatusInput(), db_session, user)
    assert any(r["id"] == str(request.id) for r in result["requests"])


# --- Analytics Aggregation -----------------------------------------------------


def test_analytics_aggregation_returns_requested_metrics(db_session, seeded):
    result = analytics_aggregation_tool(
        AnalyticsAggregationInput(metrics=["skus_below_reorder_point"]),
        db_session,
        _admin_user(seeded),
    )
    assert result["metrics"]["skus_below_reorder_point"] >= 1
    assert "total_inventory_value" not in result["metrics"]


def test_analytics_aggregation_compares_across_warehouses(db_session, seeded):
    result = analytics_aggregation_tool(
        AnalyticsAggregationInput(), db_session, _admin_user(seeded)
    )
    assert {w["warehouse_name"] for w in result["by_warehouse"]} == {
        "Nairobi Central",
        "Mombasa Port",
    }


# --- Forecast -------------------------------------------------------------


def test_forecast_tool_returns_digest(db_session, seeded):
    result = forecast_tool(
        ForecastToolInput(
            product_sku=seeded["widget"].sku,
            warehouse_id=str(seeded["nairobi"].id),
            horizon_days=7,
        ),
        db_session,
        _admin_user(seeded),
    )
    forecast = result["forecast"]
    assert forecast is not None
    assert forecast["sku"] == seeded["widget"].sku
    assert forecast["horizon_days"] == 7
    assert "total_projected_demand" in forecast
    assert "peak_day" in forecast


def test_forecast_tool_rejects_foreign_warehouse(db_session, seeded):
    with pytest.raises(ForbiddenError):
        forecast_tool(
            ForecastToolInput(
                product_sku=seeded["widget"].sku, warehouse_id=str(seeded["mombasa"].id)
            ),
            db_session,
            _nairobi_manager(seeded),
        )


def test_forecast_tool_unknown_sku_raises_not_found(db_session, seeded):
    with pytest.raises(NotFoundError):
        forecast_tool(
            ForecastToolInput(product_sku="NOPE", warehouse_id=str(seeded["nairobi"].id)),
            db_session,
            _admin_user(seeded),
        )


# --- Report Synthesis -----------------------------------------------------


def test_report_synthesis_combines_sections(db_session, seeded):
    result = report_synthesis_tool(ReportSynthesisInput(), db_session, _admin_user(seeded))
    assert {s["title"] for s in result["sections"]} == {"Inventory KPIs", "Outbound Activity"}


# --- Planner (mocked LLM — no real network/API call) --------------------------


class _FakeMessage:
    def __init__(self, content: str = "", tool_calls: list | None = None):
        self.content = content
        self.tool_calls = tool_calls or []


class _FakeBoundLLM:
    def __init__(self, message: _FakeMessage):
        self._message = message

    def invoke(self, *_args, **_kwargs):
        return self._message


def _fake_chat_anthropic(tool_name: str | None, tool_args: dict, answer: str = "Here is the data."):
    """A stand-in for ChatAnthropic: bind_tools().invoke() always returns the
    given tool call (or none); plain invoke() (the synthesize call) returns
    canned prose. Patched in via app.agent.planner.ChatAnthropic."""
    calls = [] if tool_name is None else [{"name": tool_name, "args": dict(tool_args)}]

    class _FakeChatAnthropic:
        def __init__(self, *_args, **_kwargs):
            pass

        def bind_tools(self, _tools):
            return _FakeBoundLLM(_FakeMessage(tool_calls=calls))

        def invoke(self, _prompt):
            return _FakeMessage(content=answer)

    return _FakeChatAnthropic


def test_agent_query_end_to_end_with_mocked_llm(client, seeded):
    fake = _fake_chat_anthropic(
        "InventoryQueryInput", {"below_reorder_point": True}, answer="Widget is low in Nairobi."
    )
    with patch("app.agent.planner.ChatAnthropic", fake):
        response = client.post(
            "/api/v1/agent/query",
            headers=ADMIN,
            json={"question": "what's below reorder point?", "warehouse_id": None},
        )
    assert response.status_code == 200
    body = response.json()
    assert body["tool_used"] == "inventory_query"
    assert body["answer"] == "Widget is low in Nairobi."
    assert any(r["sku"] == seeded["widget"].sku for r in body["data"]["results"])


def test_agent_query_scope_injection_overrides_llm_supplied_warehouse(client, seeded):
    """A malicious/hallucinated warehouse_id from the planner must never win
    over the caller's actual assignment (agent-core-spec.md §4.5)."""
    fake = _fake_chat_anthropic(
        "InventoryQueryInput", {"warehouse_id": str(seeded["mombasa"].id)}
    )
    with patch("app.agent.planner.ChatAnthropic", fake):
        response = client.post(
            "/api/v1/agent/query",
            headers=NAIROBI_MANAGER,
            json={"question": "what's the mombasa stock?", "warehouse_id": None},
        )
    assert response.status_code == 200
    body = response.json()
    assert body["tool_used"] == "inventory_query"
    assert {r["warehouse_name"] for r in body["data"]["results"]} == {"Nairobi Central"}


def test_agent_query_clarifies_when_no_tool_fits(client, seeded):
    fake = _fake_chat_anthropic(None, {})
    with patch("app.agent.planner.ChatAnthropic", fake):
        response = client.post(
            "/api/v1/agent/query",
            headers=ADMIN,
            json={"question": "tell me a joke", "warehouse_id": None},
        )
    assert response.status_code == 200
    body = response.json()
    assert body["tool_used"] is None
    assert "can't answer" in body["answer"].lower()
