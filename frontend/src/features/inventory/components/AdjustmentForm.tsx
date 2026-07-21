"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { submitManualAdjustment } from "@/features/inventory/actions/inventoryActions";
import type { TransactionType, Warehouse } from "@/features/inventory/types";

const typeOptions: Array<{ value: TransactionType; label: string }> = [
  { value: "adjustment", label: "Adjustment (correction / write-off)" },
  { value: "receipt", label: "Receipt (ad-hoc goods in)" },
  { value: "issue", label: "Issue (ad-hoc goods out)" },
];

export function AdjustmentForm({
  productId,
  warehouses,
}: {
  productId: string;
  warehouses: Warehouse[];
}) {
  const [warehouseId, setWarehouseId] = useState("");
  const [type, setType] = useState<TransactionType>("adjustment");
  const [delta, setDelta] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await submitManualAdjustment({
        warehouse_id: warehouseId,
        product_id: productId,
        quantity_delta: Number(delta),
        type,
      });
      if (result.ok) {
        setSuccess(true);
        setDelta("");
      } else {
        setError(result.error ?? "Could not record the adjustment.");
      }
    });
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        handleSubmit();
      }}
    >
      <Select
        label="Warehouse"
        value={warehouseId}
        onChange={(e) => setWarehouseId(e.target.value)}
        placeholder="Select a warehouse…"
        options={warehouses.map((w) => ({ value: String(w.id), label: w.name }))}
        required
      />
      <Select
        label="Transaction type"
        value={type}
        onChange={(e) => setType(e.target.value as TransactionType)}
        options={typeOptions}
      />
      <Input
        label="Quantity delta"
        type="number"
        step="1"
        value={delta}
        onChange={(e) => setDelta(e.target.value)}
        placeholder="e.g. -5 or 120"
        required
      />
      <p className="text-xs text-slate-500">
        Positive numbers add stock, negative numbers remove it.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && (
        <p className="text-sm text-emerald-600">
          Adjustment recorded — stock figures updated.
        </p>
      )}
      <Button type="submit" isLoading={isPending} className="w-full">
        Record adjustment
      </Button>
    </form>
  );
}
