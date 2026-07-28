"""End-to-end picking → packing → shipping, through the HTTP surface."""

from app.models.authorization import UserRole
from app.models.tenant import Tenant, User, UserTenant
from app.models.warehouse import UserWarehouseAssignment, Warehouse
from tests.conftest import ADMIN


def _stock(client, seeded, product, warehouse_name):
    stock = client.get(f"/api/v1/products/{seeded[product].id}/stock", headers=ADMIN).json()["stock"]
    return next(s for s in stock if s["warehouse_name"] == warehouse_name)


def _run_pick(client, request, quantities=None):
    pick = client.post(
        f"/api/v1/outbound-requests/{request['id']}/pick-lists",
        headers=ADMIN,
        json={"assigned_to": "w.otieno"},
    ).json()
    for item in pick["items"]:
        qty = (quantities or {}).get(item["product_id"], item["quantity_requested"])
        response = client.patch(
            f"/api/v1/pick-lists/{pick['id']}/items/{item['product_id']}",
            headers=ADMIN,
            json={"quantity_picked": qty, "location": "Aisle 4B"},
        )
        assert response.status_code == 200
    done = client.post(f"/api/v1/pick-lists/{pick['id']}/complete", headers=ADMIN)
    return pick, done


def test_sales_order_generates_outbound_request(client, seeded):
    order = client.post(
        "/api/v1/sales-orders",
        headers=ADMIN,
        json={
            "source_warehouse_id": str(seeded["nairobi"].id),
            "customer_name": "Tusker Mart",
            "items": [{"product_id": str(seeded["gadget"].id), "quantity_ordered": 10}],
        },
    ).json()
    assert order["outbound_request_id"] is not None
    request = client.get(
        f"/api/v1/outbound-requests/{order['outbound_request_id']}", headers=ADMIN
    ).json()
    assert request["status"] == "requested"
    assert request["destination_warehouse_id"] is None  # external


def test_full_external_flow(client, seeded):
    order = client.post(
        "/api/v1/sales-orders",
        headers=ADMIN,
        json={
            "source_warehouse_id": str(seeded["nairobi"].id),
            "customer_name": "Naivas",
            "items": [{"product_id": str(seeded["gadget"].id), "quantity_ordered": 30}],
        },
    ).json()
    request = client.get(
        f"/api/v1/outbound-requests/{order['outbound_request_id']}", headers=ADMIN
    ).json()

    _, done = _run_pick(client, request)
    assert done.status_code == 200

    # picked stock is reserved but still on hand
    row = _stock(client, seeded, "gadget", "Nairobi Central")
    assert row["quantity_on_hand"] == 200
    assert row["quantity_reserved"] == 30

    shipment = client.post(
        f"/api/v1/outbound-requests/{request['id']}/ship",
        headers=ADMIN,
        json={"carrier": "G4S", "tracking_number": "G4S123"},
    )
    assert shipment.status_code == 201

    row = _stock(client, seeded, "gadget", "Nairobi Central")
    assert row["quantity_on_hand"] == 170
    assert row["quantity_reserved"] == 0

    delivered = client.patch(
        f"/api/v1/shipments/{shipment.json()['id']}/deliver", headers=ADMIN
    ).json()
    assert delivered["status"] == "delivered"

    final = client.get(f"/api/v1/outbound-requests/{request['id']}", headers=ADMIN).json()
    assert final["status"] == "delivered"


def test_internal_transfer_moves_stock_between_warehouses(client, seeded):
    request = client.post(
        "/api/v1/outbound-requests",
        headers=ADMIN,
        json={
            "source_warehouse_id": str(seeded["nairobi"].id),
            "destination_warehouse_id": str(seeded["mombasa"].id),
            "items": [{"product_id": str(seeded["gadget"].id), "quantity_requested": 25}],
        },
    ).json()

    _run_pick(client, request)
    shipment = client.post(
        f"/api/v1/outbound-requests/{request['id']}/ship", headers=ADMIN, json={}
    ).json()
    client.patch(f"/api/v1/shipments/{shipment['id']}/deliver", headers=ADMIN)

    assert _stock(client, seeded, "gadget", "Nairobi Central")["quantity_on_hand"] == 175
    mombasa_row = _stock(client, seeded, "gadget", "Mombasa Port")
    assert mombasa_row["quantity_on_hand"] == 25  # transfer_in landed

    txs = client.get(
        "/api/v1/inventory/transactions",
        headers=ADMIN,
        params={"product_id": str(seeded["gadget"].id)},
    ).json()["items"]
    types = {t["type"] for t in txs}
    assert {"transfer_out", "transfer_in"} <= types


def test_transfer_blocked_into_deactivated_warehouse(client, seeded):
    deactivate = client.patch(
        f"/api/v1/warehouses/{seeded['mombasa'].id}",
        headers=ADMIN,
        json={"is_active": False},
    )
    assert deactivate.status_code == 200

    response = client.post(
        "/api/v1/outbound-requests",
        headers=ADMIN,
        json={
            "source_warehouse_id": str(seeded["nairobi"].id),
            "destination_warehouse_id": str(seeded["mombasa"].id),
            "items": [{"product_id": str(seeded["gadget"].id), "quantity_requested": 5}],
        },
    )
    assert response.status_code == 409


def test_transfer_blocked_from_deactivated_warehouse(client, seeded):
    deactivate = client.patch(
        f"/api/v1/warehouses/{seeded['nairobi'].id}",
        headers=ADMIN,
        json={"is_active": False},
    )
    assert deactivate.status_code == 200

    response = client.post(
        "/api/v1/outbound-requests",
        headers=ADMIN,
        json={
            "source_warehouse_id": str(seeded["nairobi"].id),
            "destination_warehouse_id": str(seeded["mombasa"].id),
            "items": [{"product_id": str(seeded["gadget"].id), "quantity_requested": 5}],
        },
    )
    assert response.status_code == 409


def test_transfer_rejects_destination_from_another_tenant(client, seeded, db_session):
    """destination_warehouse_id is a caller-supplied UUID with no scope check
    of its own otherwise — a transfer must not be able to target a warehouse
    belonging to a different tenant (developer-guide.md §13.11)."""
    other_tenant = Tenant(name="other-tenant", admin_email="other@test.local")
    db_session.add(other_tenant)
    db_session.flush()
    other_warehouse = Warehouse(name="Other Tenant WH", tenant_id=other_tenant.id)
    db_session.add(other_warehouse)
    db_session.commit()

    response = client.post(
        "/api/v1/outbound-requests",
        headers=ADMIN,
        json={
            "source_warehouse_id": str(seeded["nairobi"].id),
            "destination_warehouse_id": str(other_warehouse.id),
            "items": [{"product_id": str(seeded["gadget"].id), "quantity_requested": 5}],
        },
    )
    assert response.status_code == 403
    assert "cross-tenant" in response.json()["detail"].lower()


def test_destination_manager_can_view_but_not_act_on_inbound_transfer(client, seeded, db_session):
    """journeys.md Journey 3 / developer-guide.md §13.11: a Warehouse Manager
    assigned only to the destination warehouse can see an inbound transfer
    before delivery, but cannot pick/ship it — that stays source-only."""
    mombasa_user = "sub-mombasa-mgr"
    db_session.add(User(id=mombasa_user, email=f"{mombasa_user}@test.local", username=mombasa_user))
    db_session.add(UserTenant(user_id=mombasa_user, tenant_id=seeded["tenant"].id))
    db_session.add(UserRole(
        user_id=mombasa_user,
        role_id=seeded["roles"]["warehouse_manager"].id,
        tenant_id=seeded["tenant"].id,
    ))
    db_session.add(UserWarehouseAssignment(user_id=mombasa_user, warehouse_id=seeded["mombasa"].id))
    db_session.commit()
    mombasa_manager = {"X-Debug-User": f"{mombasa_user}:mombasa.manager:placeholder"}

    request = client.post(
        "/api/v1/outbound-requests",
        headers=ADMIN,
        json={
            "source_warehouse_id": str(seeded["nairobi"].id),
            "destination_warehouse_id": str(seeded["mombasa"].id),
            "items": [{"product_id": str(seeded["gadget"].id), "quantity_requested": 5}],
        },
    ).json()

    detail = client.get(f"/api/v1/outbound-requests/{request['id']}", headers=mombasa_manager)
    assert detail.status_code == 200

    listing = client.get(
        "/api/v1/outbound-requests",
        headers=mombasa_manager,
        params={"warehouse_id": str(seeded["mombasa"].id)},
    ).json()
    assert request["id"] in {item["id"] for item in listing["items"]}

    pick_attempt = client.post(
        f"/api/v1/outbound-requests/{request['id']}/pick-lists",
        headers=mombasa_manager,
        json={},
    )
    assert pick_attempt.status_code == 403


def test_cannot_ship_before_picking(client, seeded):
    order = client.post(
        "/api/v1/sales-orders",
        headers=ADMIN,
        json={
            "source_warehouse_id": str(seeded["nairobi"].id),
            "customer_name": "X",
            "items": [{"product_id": str(seeded["gadget"].id), "quantity_ordered": 5}],
        },
    ).json()
    response = client.post(
        f"/api/v1/outbound-requests/{order['outbound_request_id']}/ship", headers=ADMIN, json={}
    )
    assert response.status_code == 409


def test_cannot_pick_more_than_available(client, seeded):
    # widget in Nairobi has 50 on hand; request 60 and try to complete
    request = client.post(
        "/api/v1/outbound-requests",
        headers=ADMIN,
        json={
            "source_warehouse_id": str(seeded["nairobi"].id),
            "destination_warehouse_id": str(seeded["mombasa"].id),
            "items": [{"product_id": str(seeded["widget"].id), "quantity_requested": 60}],
        },
    ).json()
    _, done = _run_pick(client, request)
    assert done.status_code == 409  # InsufficientStock on complete


def test_overpick_line_rejected(client, seeded):
    request = client.post(
        "/api/v1/outbound-requests",
        headers=ADMIN,
        json={
            "source_warehouse_id": str(seeded["nairobi"].id),
            "destination_warehouse_id": str(seeded["mombasa"].id),
            "items": [{"product_id": str(seeded["gadget"].id), "quantity_requested": 5}],
        },
    ).json()
    pick = client.post(
        f"/api/v1/outbound-requests/{request['id']}/pick-lists", headers=ADMIN, json={}
    ).json()
    response = client.patch(
        f"/api/v1/pick-lists/{pick['id']}/items/{seeded['gadget'].id}",
        headers=ADMIN,
        json={"quantity_picked": 9},
    )
    assert response.status_code == 409
