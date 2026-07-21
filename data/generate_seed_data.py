"""Synthetic seed data generator.

Run AFTER migrations, from the repo root (or anywhere — it fixes sys.path):

    python data/generate_seed_data.py

Deterministic (seeded RNG). Produces everything Section 12 demands:
  - 3 warehouses, 24 products, 5 suppliers, ~14 months of PO + demand history
  - per-warehouse reorder points that actually differ, incl. one product with
    a DIFFERENT threshold in two warehouses (catches global-value bugs)
  - at least one product per warehouse deliberately below reorder point
  - one supplier ("Slowpoke Logistics") with a consistently bad on-time record
  - one outbound request in EVERY status, driven through the real service-layer
    state machine (not fabricated rows), incl. one pick list item with a
    free-text location
  - one sales order that generated an outbound request end to end
  - one scoped user in user_warehouse_assignments (Nairobi only)

Demand history has weekly seasonality + trend so Prophet has something to find.
"""

import math
import random
import sys
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from sqlalchemy import func, select  # noqa: E402

from app.core.database import SessionLocal  # noqa: E402
from app.models import (  # noqa: E402
    InventoryTransaction,
    Product,
    PurchaseOrder,
    PurchaseOrderItem,
    Supplier,
    UserWarehouseAssignment,
    Warehouse,
    WarehouseStock,
)
from app.models.inventory import TransactionType  # noqa: E402
from app.models.procurement import POStatus  # noqa: E402
from app.schemas.outbound import (  # noqa: E402
    LineItemCreate,
    OutboundItemCreate,
    OutboundRequestCreate,
    PickItemUpdate,
    PickListCreate,
    SalesOrderCreate,
    ShipRequest,
)
from app.services import outbound_service  # noqa: E402
from app.models.outbound import OutboundStatus  # noqa: E402

rng = random.Random(42)

HISTORY_DAYS = 420
TODAY = date.today()

CATEGORIES = ["Beverages", "Dry Goods", "Cleaning", "Electronics", "Packaging", "Fresh"]
SCOPED_USER = ("seed-user-nairobi-mgr", "nairobi.manager")


def ts(d: date, hour: int = 12) -> datetime:
    return datetime.combine(d, time(hour=hour), tzinfo=timezone.utc)


def main() -> None:
    with SessionLocal() as db:
        if db.execute(select(func.count()).select_from(Warehouse)).scalar_one():
            print("Database already has warehouses — refusing to double-seed.")
            return

        print("Seeding warehouses, products, suppliers...")
        warehouses = [
            Warehouse(name="Nairobi Central", address="Enterprise Rd, Nairobi"),
            Warehouse(name="Mombasa Port", address="Port Reitz Rd, Mombasa"),
            Warehouse(name="Kisumu Depot", address="Obote Rd, Kisumu"),
        ]
        products = [
            Product(
                sku=f"SKU-{1000 + i}",
                name=f"{rng.choice(['Premium', 'Standard', 'Bulk', 'Eco'])} "
                f"{rng.choice(['Water', 'Rice', 'Detergent', 'Cable', 'Carton', 'Juice', 'Flour', 'Soap'])} "
                f"{rng.choice(['500g', '1kg', '5L', '10pk', 'XL'])} #{i}",
                category=rng.choice(CATEGORIES),
                unit_cost=Decimal(str(round(rng.uniform(0.8, 120.0), 2))),
            )
            for i in range(24)
        ]
        suppliers = [
            Supplier(name="Acme Trading Co", lead_time_days=5, contact_email="orders@acme.example"),
            Supplier(name="Savanna Wholesale", lead_time_days=7, contact_email="po@savanna.example"),
            Supplier(name="Slowpoke Logistics", lead_time_days=4, contact_email="maybe@slowpoke.example"),
            Supplier(name="Coastal Imports", lead_time_days=10, contact_email="sales@coastal.example"),
            Supplier(name="Highland Farms", lead_time_days=3, contact_email="farm@highland.example"),
        ]
        db.add_all(warehouses + products + suppliers)
        db.flush()

        slowpoke = suppliers[2]

        # --- PO history with receipts (stock inflow) -----------------------
        print("Seeding purchase-order history...")
        start = TODAY - timedelta(days=HISTORY_DAYS)
        for wh in warehouses:
            assortment = rng.sample(products, 16)
            order_day = start
            while order_day < TODAY - timedelta(days=7):
                supplier = rng.choice(suppliers)
                expected = order_day + timedelta(days=supplier.lead_time_days or 5)
                # Slowpoke is late 80% of the time, others 15%
                late_by = (
                    rng.randint(2, 9) if rng.random() < (0.8 if supplier is slowpoke else 0.15) else 0
                )
                actual = expected + timedelta(days=late_by)
                po = PurchaseOrder(
                    supplier_id=supplier.id,
                    destination_warehouse_id=wh.id,
                    status=POStatus.RECEIVED,
                    order_date=order_day,
                    expected_delivery_date=expected,
                    actual_delivery_date=actual,
                )
                db.add(po)
                db.flush()
                for product in rng.sample(assortment, rng.randint(3, 7)):
                    qty = rng.randint(80, 400)
                    db.add(
                        PurchaseOrderItem(
                            purchase_order_id=po.id,
                            product_id=product.id,
                            quantity_ordered=qty,
                            quantity_received=qty,
                        )
                    )
                    db.add(
                        InventoryTransaction(
                            warehouse_id=wh.id,
                            product_id=product.id,
                            quantity_delta=qty,
                            type=TransactionType.RECEIPT,
                            reference_id=po.id,
                            occurred_at=ts(min(actual, TODAY), hour=9),
                        )
                    )
                order_day += timedelta(days=rng.randint(6, 12))

            # A few open POs so the procurement screen has something actionable
            for status in (POStatus.PENDING, POStatus.CONFIRMED):
                supplier = rng.choice(suppliers)
                po = PurchaseOrder(
                    supplier_id=supplier.id,
                    destination_warehouse_id=wh.id,
                    status=status,
                    order_date=TODAY - timedelta(days=2),
                    expected_delivery_date=TODAY + timedelta(days=supplier.lead_time_days or 5),
                )
                db.add(po)
                db.flush()
                for product in rng.sample(assortment, 3):
                    db.add(
                        PurchaseOrderItem(
                            purchase_order_id=po.id,
                            product_id=product.id,
                            quantity_ordered=rng.randint(50, 200),
                        )
                    )
        db.flush()

        # --- daily demand (stock outflow) with seasonality ------------------
        print("Seeding demand history (issues)...")
        received: dict[tuple, int] = {}
        for wh_id, p_id, total in db.execute(
            select(
                InventoryTransaction.warehouse_id,
                InventoryTransaction.product_id,
                func.sum(InventoryTransaction.quantity_delta),
            )
            .where(InventoryTransaction.type == TransactionType.RECEIPT)
            .group_by(InventoryTransaction.warehouse_id, InventoryTransaction.product_id)
        ):
            received[(wh_id, p_id)] = int(total)

        issued: dict[tuple, int] = {key: 0 for key in received}
        for (wh_id, p_id), total_in in received.items():
            base = rng.uniform(1.5, 9.0)  # product-specific base daily demand
            budget = int(total_in * rng.uniform(0.65, 0.85))  # never oversell inflow
            for offset in range(HISTORY_DAYS, 0, -1):
                day = TODAY - timedelta(days=offset)
                weekly = 1.0 + 0.45 * math.sin(2 * math.pi * day.weekday() / 7)
                trend = 1.0 + 0.3 * (HISTORY_DAYS - offset) / HISTORY_DAYS
                qty = max(0, int(rng.gauss(base * weekly * trend, base * 0.35)))
                qty = min(qty, budget - issued[(wh_id, p_id)])
                if qty <= 0:
                    continue
                issued[(wh_id, p_id)] += qty
                db.add(
                    InventoryTransaction(
                        warehouse_id=wh_id,
                        product_id=p_id,
                        quantity_delta=-qty,
                        type=TransactionType.ISSUE,
                        occurred_at=ts(day, hour=15),
                    )
                )
        db.flush()

        # --- materialize warehouse_stock from the transaction log -----------
        print("Materializing warehouse_stock...")
        for (wh_id, p_id), total_in in received.items():
            on_hand = total_in - issued[(wh_id, p_id)]
            db.add(
                WarehouseStock(
                    warehouse_id=wh_id,
                    product_id=p_id,
                    quantity_on_hand=on_hand,
                    # varied thresholds; corrected for the special cases below
                    reorder_point=max(10, int(on_hand * rng.uniform(0.15, 0.5))),
                )
            )
        db.flush()

        stock_rows = list(db.execute(select(WarehouseStock)).scalars())
        by_warehouse: dict = {}
        for row in stock_rows:
            by_warehouse.setdefault(row.warehouse_id, []).append(row)

        # One product with a DIFFERENT reorder threshold in two warehouses
        # (Section 12: catches code that silently reads a global value).
        # Set this FIRST so the below-reorder rows below can avoid the shared
        # product — otherwise this override can undo a below-reorder threshold.
        shared = None
        for row_a in by_warehouse[warehouses[0].id]:
            for row_b in by_warehouse[warehouses[1].id]:
                if row_a.product_id == row_b.product_id:
                    shared = (row_a, row_b)
                    break
            if shared:
                break
        if shared:
            shared[0].reorder_point = 40
            shared[1].reorder_point = 175

        # One product per warehouse deliberately below reorder point
        shared_pid = shared[0].product_id if shared else None
        for wh in warehouses:
            row = next(r for r in by_warehouse[wh.id] if r.product_id != shared_pid)
            row.reorder_point = row.quantity_on_hand + rng.randint(20, 60)
        db.flush()

        # --- RBAC: one user scoped to a single warehouse ---------------------
        db.add(UserWarehouseAssignment(user_id=SCOPED_USER[0], warehouse_id=warehouses[0].id))
        db.commit()

        # --- outbound requests in every status, via the REAL state machine ---
        print("Seeding outbound workflow (one request per status)...")
        nairobi, mombasa = warehouses[0], warehouses[1]

        def pickable(wh, count):
            rows = [r for r in by_warehouse[wh.id] if r.quantity_on_hand - r.quantity_reserved > 30]
            return rng.sample(rows, count)

        # 1. requested — the end-to-end sales order (Section 12)
        so_items = [
            LineItemCreate(product_id=r.product_id, quantity_ordered=rng.randint(5, 15))
            for r in pickable(nairobi, 2)
        ]
        outbound_service.create_sales_order(
            db,
            SalesOrderCreate(
                source_warehouse_id=nairobi.id, customer_name="Tusker Mart Ltd", items=so_items
            ),
        )

        def make_request(source, dest=None, n_items=2):
            if dest is not None:
                return outbound_service.create_internal_transfer(
                    db,
                    OutboundRequestCreate(
                        source_warehouse_id=source.id,
                        destination_warehouse_id=dest.id,
                        items=[
                            OutboundItemCreate(
                                product_id=r.product_id, quantity_requested=rng.randint(5, 20)
                            )
                            for r in pickable(source, n_items)
                        ],
                    ),
                )
            _, request = outbound_service.create_sales_order(
                db,
                SalesOrderCreate(
                    source_warehouse_id=source.id,
                    customer_name=rng.choice(["Naivas", "Quickmart", "Chandarana"]),
                    items=[
                        LineItemCreate(
                            product_id=r.product_id, quantity_ordered=rng.randint(5, 20)
                        )
                        for r in pickable(source, n_items)
                    ],
                ),
            )
            return request

        def advance(request, to_status):
            pick_list = outbound_service.generate_pick_list(
                db, request.id, PickListCreate(assigned_to="w.otieno")
            )
            if to_status == OutboundStatus.PICKING:
                # partially picked, with a location set (Section 12)
                first = pick_list.items[0]
                outbound_service.record_pick(
                    db,
                    pick_list.id,
                    first.product_id,
                    PickItemUpdate(quantity_picked=first.quantity_requested, location="Aisle 4B"),
                )
                return
            for item in pick_list.items:
                outbound_service.record_pick(
                    db,
                    pick_list.id,
                    item.product_id,
                    PickItemUpdate(
                        quantity_picked=item.quantity_requested,
                        location=f"Aisle {rng.randint(1, 9)}{rng.choice('ABC')}",
                    ),
                )
            outbound_service.complete_pick_list(db, pick_list.id)
            if to_status == OutboundStatus.PACKED:
                return
            shipment = outbound_service.ship(
                db, request.id, ShipRequest(carrier="G4S", tracking_number=f"G4S{rng.randint(10**8, 10**9)}")
            )
            if to_status == OutboundStatus.DELIVERED:
                outbound_service.deliver(db, shipment.id)

        advance(make_request(mombasa), OutboundStatus.PICKING)
        advance(make_request(nairobi), OutboundStatus.PACKED)
        advance(make_request(mombasa), OutboundStatus.SHIPPED)
        advance(make_request(nairobi, dest=mombasa), OutboundStatus.DELIVERED)  # internal transfer

        cancelled = make_request(mombasa)
        cancelled.status = OutboundStatus.CANCELLED
        db.commit()

        # --- summary ---------------------------------------------------------
        tx_count = db.execute(select(func.count()).select_from(InventoryTransaction)).scalar_one()
        print(
            f"Done. {len(warehouses)} warehouses, {len(products)} products, "
            f"{len(suppliers)} suppliers, {tx_count} inventory transactions."
        )
        print(f"Scoped user for RBAC tests: sub={SCOPED_USER[0]} -> {nairobi.name} only")
        print("Bad-delivery supplier: Slowpoke Logistics (late ~80% of the time)")


if __name__ == "__main__":
    main()
