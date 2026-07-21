"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { submitNewProduct } from "@/features/inventory/actions/inventoryActions";

const emptyForm = { sku: "", name: "", category: "", unit_cost: "" };

export function NewProductModal() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const close = () => {
    setOpen(false);
    setForm(emptyForm);
    setError(null);
  };

  const handleSubmit = () => {
    setError(null);
    startTransition(async () => {
      const result = await submitNewProduct({
        sku: form.sku.trim(),
        name: form.name.trim(),
        category: form.category.trim(),
        unit_cost: Number(form.unit_cost),
      });
      if (result.ok) {
        close();
      } else {
        setError(result.error ?? "Could not create the product.");
      }
    });
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>New product</Button>
      <Modal open={open} onClose={close} title="New product">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit();
          }}
        >
          <Input
            label="SKU"
            value={form.sku}
            onChange={(e) => setForm({ ...form, sku: e.target.value })}
            placeholder="e.g. WL-1042"
            required
          />
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Pallet wrap, 500mm"
            required
          />
          <Input
            label="Category"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            placeholder="e.g. Packaging"
            required
          />
          <Input
            label="Unit cost (USD)"
            type="number"
            min="0"
            step="0.01"
            value={form.unit_cost}
            onChange={(e) => setForm({ ...form, unit_cost: e.target.value })}
            required
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={close} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isPending}>
              Create product
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
