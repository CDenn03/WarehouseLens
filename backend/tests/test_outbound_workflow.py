"""End-to-end picking → packing → shipping, through the HTTP surface."""

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
    ).json()
    types = {t["type"] for t in txs}
    assert {"transfer_out", "transfer_in"} <= types


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
