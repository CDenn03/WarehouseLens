"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";
import { todayIso } from "@/lib/utils";
import type { Product, Warehouse } from "@/features/inventory/types";
import type { Supplier } from "@/features/procurement/types";
import { submitNewPurchaseOrder } from "@/features/procurement/actions/procurementActions";

interface LineItem {
  product_id: string;
  quantity: string;
}

export function CreatePurchaseOrderModal({
  suppliers,
  warehouses,
  products,
}: {
  suppliers: Supplier[];
  warehouses: Warehouse[];
  products: Product[];
}) {
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [orderDate, setOrderDate] = useState(todayIso());
  const [expectedDate, setExpectedDate] = useState("");
  const [items, setItems] = useState<LineItem[]>([
    { product_id: "", quantity: "" },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const reset = () => {
    setSupplierId("");
    setWarehouseId("");
    setOrderDate(todayIso());
    setExpectedDate("");
    setItems([{ product_id: "", quantity: "" }]);
    setError(null);
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  const updateItem = (index: number, patch: Partial<LineItem>) => {
    setItems((current) =>
      current.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  };

  const handleSubmit = () => {
    setError(null);
    startTransition(async () => {
      const result = await submitNewPurchaseOrder({
        supplier_id: supplierId,
        destination_warehouse_id: warehouseId,
        order_date: orderDate,
        expected_delivery_date: expectedDate,
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
        setError(result.error ?? "Could not create the purchase order.");
      }
    });
  };

  const productOptions = products.map((p) => ({
    value: String(p.id),
    label: `${p.sku} — ${p.name}`,
  }));

  return (
    <>
      <Button onClick={() => setOpen(true)}>New purchase order</Button>
      <Modal
        open={open}
        onClose={close}
        title="New purchase order"
        description="Order stock from a supplier into a warehouse"
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
              label="Supplier"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              placeholder="Select a supplier…"
              options={suppliers.map((s) => ({
                value: String(s.id),
                label: s.name,
              }))}
              required
            />
            <Select
              label="Destination warehouse"
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
              label="Order date"
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              required
            />
            <Input
              label="Expected delivery"
              type="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
              required
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-slate-700">
              Line items
            </legend>
            {items.map((item, index) => (
              <div key={index} className="flex items-start gap-2">
                <div className="flex-1">
                  <Select
                    value={item.product_id}
                    onChange={(e) =>
                      updateItem(index, { product_id: e.target.value })
                    }
                    placeholder="Select a product…"
                    options={productOptions}
                    aria-label={`Line ${index + 1} product`}
                  />
                </div>
                <div className="w-28">
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(index, { quantity: e.target.value })
                    }
                    placeholder="Qty"
                    aria-label={`Line ${index + 1} quantity`}
                  />
                </div>
                <Button
                  variant="ghost"
                  onClick={() =>
                    setItems((current) =>
                      current.length > 1
                        ? current.filter((_, i) => i !== index)
                        : current,
                    )
                  }
                  disabled={items.length === 1}
                  aria-label={`Remove line ${index + 1}`}
                >
                  ✕
                </Button>
              </div>
            ))}
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                setItems((current) => [
                  ...current,
                  { product_id: "", quantity: "" },
                ])
              }
            >
              Add line
            </Button>
          </fieldset>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={close} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isPending}>
              Create purchase order
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
