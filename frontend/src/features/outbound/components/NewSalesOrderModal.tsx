"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";
import type { Product, Warehouse } from "@/features/inventory/types";
import { submitSalesOrder } from "@/features/outbound/actions/outboundActions";
import {
  emptyLineItem,
  LineItemsEditor,
} from "@/features/outbound/components/LineItemsEditor";
import type { EditableLineItem } from "@/features/outbound/components/LineItemsEditor";

export function NewSalesOrderModal({
  warehouses,
  products,
}: {
  warehouses: Warehouse[];
  products: Product[];
}) {
  const [open, setOpen] = useState(false);
  const [warehouseId, setWarehouseId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [items, setItems] = useState<EditableLineItem[]>([{ ...emptyLineItem }]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const close = () => {
    setOpen(false);
    setWarehouseId("");
    setCustomerName("");
    setItems([{ ...emptyLineItem }]);
    setError(null);
  };

  const handleSubmit = () => {
    setError(null);
    startTransition(async () => {
      const result = await submitSalesOrder({
        source_warehouse_id: warehouseId,
        customer_name: customerName.trim(),
        items: items
          .filter((item) => item.product_id || item.quantity)
          .map((item) => ({
            product_id: item.product_id,
            quantity_ordered: Number(item.quantity),
          })),
      });
      if (result.ok) {
        close();
      } else {
        setError(result.error ?? "Could not create the sales order.");
      }
    });
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>New sales order</Button>
      <Modal
        open={open}
        onClose={close}
        title="New sales order"
        description="Creating a sales order automatically generates a linked outbound request"
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
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              placeholder="Select a warehouse…"
              options={warehouses.map((w) => ({
                value: String(w.id),
                label: w.name,
              }))}
              required
            />
            <Input
              label="Customer name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. Northwind Retail"
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
              Create sales order
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
