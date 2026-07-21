"use client";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import type { Product } from "@/features/inventory/types";

export interface EditableLineItem {
  product_id: string;
  quantity: string;
}

export const emptyLineItem: EditableLineItem = { product_id: "", quantity: "" };

export function LineItemsEditor({
  items,
  onChange,
  products,
}: {
  items: EditableLineItem[];
  onChange: (items: EditableLineItem[]) => void;
  products: Product[];
}) {
  const productOptions = products.map((p) => ({
    value: String(p.id),
    label: `${p.sku} — ${p.name}`,
  }));

  const update = (index: number, patch: Partial<EditableLineItem>) => {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-slate-700">Line items</legend>
      {items.map((item, index) => (
        <div key={index} className="flex items-start gap-2">
          <div className="flex-1">
            <Select
              value={item.product_id}
              onChange={(e) => update(index, { product_id: e.target.value })}
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
              onChange={(e) => update(index, { quantity: e.target.value })}
              placeholder="Qty"
              aria-label={`Line ${index + 1} quantity`}
            />
          </div>
          <Button
            variant="ghost"
            onClick={() =>
              onChange(
                items.length > 1 ? items.filter((_, i) => i !== index) : items,
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
        onClick={() => onChange([...items, { ...emptyLineItem }])}
      >
        Add line
      </Button>
    </fieldset>
  );
}
