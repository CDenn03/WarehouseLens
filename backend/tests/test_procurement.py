from tests.conftest import ADMIN, AUDITOR


def _create_po(client, seeded, today, qty=100):
    return client.post(
        "/api/v1/purchase-orders",
        headers=ADMIN,
        json={
            "supplier_id": str(seeded["supplier"].id),
            "destination_warehouse_id": str(seeded["nairobi"].id),
            "order_date": today,
            "expected_delivery_date": today,
            "items": [{"product_id": str(seeded["widget"].id), "quantity_ordered": qty}],
        },
    )


def test_create_and_receive_po_moves_stock(client, seeded, today):
    po = _create_po(client, seeded, today).json()
    assert po["status"] == "pending"

    received = client.post(f"/api/v1/purchase-orders/{po['id']}/receive", headers=ADMIN).json()
    assert received["status"] == "received"
    assert received["items"][0]["quantity_received"] == 100

    stock = client.get(
        f"/api/v1/products/{seeded['widget'].id}/stock", headers=ADMIN
    ).json()["stock"]
    nairobi_row = next(s for s in stock if s["warehouse_name"] == "Nairobi Central")
    assert nairobi_row["quantity_on_hand"] == 150  # 50 seeded + 100 received

    txs = client.get(
        "/api/v1/inventory/transactions",
        headers=ADMIN,
        params={"product_id": str(seeded["widget"].id)},
    ).json()
    assert any(t["type"] == "receipt" and t["quantity_delta"] == 100 for t in txs)


def test_receive_twice_conflicts(client, seeded, today):
    po = _create_po(client, seeded, today).json()
    assert client.post(f"/api/v1/purchase-orders/{po['id']}/receive", headers=ADMIN).status_code == 200
    assert client.post(f"/api/v1/purchase-orders/{po['id']}/receive", headers=ADMIN).status_code == 409


def test_auditor_cannot_create_po(client, seeded, today):
    response = client.post(
        "/api/v1/purchase-orders",
        headers=AUDITOR,
        json={
            "supplier_id": str(seeded["supplier"].id),
            "destination_warehouse_id": str(seeded["nairobi"].id),
            "order_date": today,
            "items": [{"product_id": str(seeded["widget"].id), "quantity_ordered": 1}],
        },
    )
    assert response.status_code == 403


def test_partial_receive(client, seeded, today):
    po = _create_po(client, seeded, today).json()
    received = client.post(
        f"/api/v1/purchase-orders/{po['id']}/receive",
        headers=ADMIN,
        json={"items": [{"product_id": str(seeded["widget"].id), "quantity_received": 40}]},
    ).json()
    assert received["items"][0]["quantity_received"] == 40
