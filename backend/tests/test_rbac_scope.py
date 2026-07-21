"""Warehouse-scope enforcement (Sections 9, 13.3) — the guide calls a miss here
a correctness bug, not cosmetic. The scoped user is assigned to Nairobi only."""

from tests.conftest import ADMIN, AUDITOR, NAIROBI_MANAGER


def test_scoped_user_blocked_from_other_warehouse(client, seeded):
    response = client.get(
        "/api/v1/dashboard/kpis",
        headers=NAIROBI_MANAGER,
        params={"warehouse_id": str(seeded["mombasa"].id)},
    )
    assert response.status_code == 403


def test_scoped_user_allowed_in_assigned_warehouse(client, seeded):
    response = client.get(
        "/api/v1/dashboard/kpis",
        headers=NAIROBI_MANAGER,
        params={"warehouse_id": str(seeded["nairobi"].id)},
    )
    assert response.status_code == 200


def test_scoped_list_is_filtered_not_403(client, seeded):
    """List endpoints without an explicit warehouse filter return only the
    caller's assigned warehouses."""
    stock = client.get(
        f"/api/v1/products/{seeded['widget'].id}/stock", headers=NAIROBI_MANAGER
    ).json()["stock"]
    assert [s["warehouse_name"] for s in stock] == ["Nairobi Central"]


def test_scoped_user_cannot_adjust_other_warehouse(client, seeded):
    response = client.post(
        "/api/v1/inventory/transactions",
        headers=NAIROBI_MANAGER,
        json={
            "warehouse_id": str(seeded["mombasa"].id),
            "product_id": str(seeded["widget"].id),
            "quantity_delta": 5,
            "type": "adjustment",
        },
    )
    assert response.status_code == 403


def test_agent_query_scope_gate(client, seeded):
    """The agent must refuse before the planner runs (Section 9)."""
    response = client.post(
        "/api/v1/agent/query",
        headers=NAIROBI_MANAGER,
        json={"question": "What is below reorder point?", "warehouse_id": str(seeded["mombasa"].id)},
    )
    assert response.status_code == 403


def test_auditor_reads_everywhere_writes_nowhere(client, seeded):
    assert (
        client.get(
            "/api/v1/dashboard/kpis",
            headers=AUDITOR,
            params={"warehouse_id": str(seeded["mombasa"].id)},
        ).status_code
        == 200
    )
    assert (
        client.post(
            "/api/v1/warehouses", headers=AUDITOR, json={"name": "Rogue"}
        ).status_code
        == 403
    )


def test_only_admin_assigns_users(client, seeded):
    response = client.post(
        f"/api/v1/warehouses/{seeded['nairobi'].id}/assignments",
        headers=NAIROBI_MANAGER,
        json={"user_id": "someone"},
    )
    assert response.status_code == 403
    response = client.post(
        f"/api/v1/warehouses/{seeded['mombasa'].id}/assignments",
        headers=ADMIN,
        json={"user_id": "sub-new-user"},
    )
    assert response.status_code == 201


def test_per_warehouse_reorder_points_are_independent(client, seeded):
    """Same product, different thresholds per warehouse (Section 13.4) — a bug
    reading a global value shows up here."""
    stock = client.get(f"/api/v1/products/{seeded['widget'].id}/stock", headers=ADMIN).json()["stock"]
    by_name = {s["warehouse_name"]: s for s in stock}
    assert by_name["Nairobi Central"]["reorder_point"] == 80
    assert by_name["Mombasa Port"]["reorder_point"] == 20
    assert by_name["Nairobi Central"]["below_reorder_point"] is True
    assert by_name["Mombasa Port"]["below_reorder_point"] is False
