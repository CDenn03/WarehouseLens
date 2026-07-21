"""Worker aggregation logic, run directly against the session (no HTTP)."""

from datetime import date

from sqlalchemy import select

from app import worker
from app.models import DailyWarehouseMetric, WarehouseStock
from app.services import inventory_service, outbound_service
from app.schemas.outbound import (
    OutboundItemCreate,
    OutboundRequestCreate,
    PickItemUpdate,
    PickListCreate,
)


def test_aggregate_daily_metrics(db_session, seeded):
    from app.schemas.inventory import TransactionCreate

    inventory_service.create_manual_transaction(
        db_session,
        TransactionCreate(
            warehouse_id=seeded["nairobi"].id,
            product_id=seeded["gadget"].id,
            quantity_delta=-20,
            type="issue",
        ),
    )
    rows = worker.aggregate_daily_metrics(db_session)
    assert rows > 0

    metric = db_session.execute(
        select(DailyWarehouseMetric).where(
            DailyWarehouseMetric.warehouse_id == seeded["nairobi"].id,
            DailyWarehouseMetric.metric_date == date.today(),
        )
    ).scalar_one()
    assert metric.units_issued == 20
    assert metric.closing_quantity_on_hand == 230  # 50 + 200 - 20


def test_reservation_recalculation_heals_drift(db_session, seeded):
    request = outbound_service.create_internal_transfer(
        db_session,
        OutboundRequestCreate(
            source_warehouse_id=seeded["nairobi"].id,
            destination_warehouse_id=seeded["mombasa"].id,
            items=[OutboundItemCreate(product_id=seeded["gadget"].id, quantity_requested=15)],
        ),
    )
    pick = outbound_service.generate_pick_list(db_session, request.id, PickListCreate())
    outbound_service.record_pick(
        db_session, pick.id, seeded["gadget"].id, PickItemUpdate(quantity_picked=15)
    )
    outbound_service.complete_pick_list(db_session, pick.id)

    # sabotage the reservation, as a crashed request path might
    stock = db_session.get(WarehouseStock, (seeded["nairobi"].id, seeded["gadget"].id))
    stock.quantity_reserved = 999
    db_session.commit()

    changed = worker.recalculate_reservations(db_session)
    assert changed >= 1
    db_session.refresh(stock)
    assert stock.quantity_reserved == 15
