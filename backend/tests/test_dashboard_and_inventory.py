from tests.conftest import ADMIN


def test_kpis(client, seeded):
    kpis = client.get("/api/v1/dashboard/kpis", headers=ADMIN).json()
    # 50*10 + 50*10 + 200*25 = 6000
    assert float(kpis["total_inventory_value"]) == 6000.0
    assert kpis["skus_below_reorder_point"] == 1  # widget in Nairobi only
    assert kpis["open_outbound_requests"] == 0


def test_kpis_scoped_to_warehouse(client, seeded):
    kpis = client.get(
        "/api/v1/dashboard/kpis", headers=ADMIN, params={"warehouse_id": str(seeded["mombasa"].id)}
    ).json()
    assert float(kpis["total_inventory_value"]) == 500.0  # 50 widgets * 10


def test_abc_ranking(client, seeded):
    ranking = client.get("/api/v1/dashboard/charts/abc-ranking", headers=ADMIN).json()
    assert ranking[0]["sku"] == "SKU-2"  # gadget: 5000 of 6000 total value
    assert ranking[0]["abc_class"] == "A"
    # widget starts at 5000/6000 ≈ 83% of cumulative value → class B
    assert ranking[-1]["abc_class"] == "B"
    assert ranking[-1]["cumulative_share"] == 1.0


def test_stock_trend_reflects_movement(client, seeded):
    client.post(
        "/api/v1/inventory/transactions",
        headers=ADMIN,
        json={
            "warehouse_id": str(seeded["nairobi"].id),
            "product_id": str(seeded["widget"].id),
            "quantity_delta": -10,
            "type": "adjustment",
        },
    )
    trend = client.get(
        "/api/v1/dashboard/charts/stock-trend", headers=ADMIN, params={"days": 7}
    ).json()
    assert len(trend) == 7
    assert trend[-1]["total_quantity_on_hand"] == 290  # 300 seeded - 10
    assert trend[0]["total_quantity_on_hand"] == 300  # before today's adjustment


def test_adjustment_cannot_go_negative(client, seeded):
    response = client.post(
        "/api/v1/inventory/transactions",
        headers=ADMIN,
        json={
            "warehouse_id": str(seeded["nairobi"].id),
            "product_id": str(seeded["widget"].id),
            "quantity_delta": -999,
            "type": "adjustment",
        },
    )
    assert response.status_code == 409


def test_invalid_transaction_type_rejected(client, seeded):
    response = client.post(
        "/api/v1/inventory/transactions",
        headers=ADMIN,
        json={
            "warehouse_id": str(seeded["nairobi"].id),
            "product_id": str(seeded["widget"].id),
            "quantity_delta": 1,
            "type": "teleport",
        },
    )
    assert response.status_code == 422


def test_duplicate_sku_conflict(client, seeded):
    response = client.post(
        "/api/v1/products",
        headers=ADMIN,
        json={"sku": "SKU-1", "name": "Dupe", "unit_cost": "1.00"},
    )
    assert response.status_code == 409


def test_agent_scaffold_responds(client, seeded):
    response = client.post(
        "/api/v1/agent/query", headers=ADMIN, json={"question": "hello", "warehouse_id": None}
    )
    assert response.status_code == 200
    assert "scaffold" in response.json()["answer"]
