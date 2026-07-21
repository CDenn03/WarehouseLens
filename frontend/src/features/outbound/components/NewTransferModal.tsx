"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";
import type { Product, Warehouse } from "@/features/inventory/types";
import { submitInternalTransfer } from "@/features/outbound/actions/outboundActions";
import {
  emptyLineItem,
  LineItemsEditor,
} from "@/features/outbound/components/LineItemsEditor";
import type { EditableLineItem } from "@/features/outbound/components/LineItemsEditor";

export function NewTransferModal({
  warehouses,
  products,
}: {
  warehouses: Warehouse[];
  products: Product[];
}) {
  const [open, setOpen] = useState(false);
  const [sourceId, setSourceId] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [items, setItems] = useState<EditableLineItem[]>([{ ...emptyLineItem }]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const close = () => {
    setOpen(false);
    setSourceId("");
    setDestinationId("");
    setItems([{ ...emptyLineItem }]);
    setError(null);
  };

  const warehouseOptions = warehouses.map((w) => ({
    value: String(w.id),
    label: w.name,
  }));

  const handleSubmit = () => {
    setError(null);
    startTransition(async () => {
      const result = await submitInternalTransfer({
        source_warehouse_id: sourceId,
        destination_warehouse_id: destinationId,
        items: items
          .filter((item) => item.product_id || item.quantity)
          .map((item) => ({
            product_id: item.product_id,
            quantity_requested: Number(item.quantity),
          })),
      });
      if (result.ok) {
        close();
      } else {
        setError(result.error ?? "Could not create the transfer.");
      }
    });
  };

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        New internal transfer
      </Button>
      <Modal
        open={open}
        onClose={close}
        title="New internal transfer"
        description="Move stock between warehouses via an outbound request"
        widthClassName="max-w-2xl"
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Source warehouse"
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              placeholder="Select a warehouse…"
              options={warehouseOptions}
              required
            />
            <Select
              label="Destination warehouse"
              value={destinationId}
              onChange={(e) => setDestinationId(e.target.value)}
              placeholder="Select a warehouse…"
              options={warehouseOptions.filter((o) => o.value !== sourceId)}
              required
            />
          </div>
          <LineItemsEditor items={items} onChange={setItems} products={products} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={close} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isPending}>
              Create transfer
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
