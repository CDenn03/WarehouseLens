"use client";

import { useTransition } from "react";
import { submitSetWarehouseActive } from "@/features/warehouse/actions/warehouseActions";

interface Props {
  warehouseId: string;
  warehouseName: string;
  isActive: boolean;
}

export function ToggleWarehouseActiveButton({ warehouseId, warehouseName, isActive }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    const message = isActive
      ? `Deactivate "${warehouseName}"? It will stay in the system but be marked inactive.`
      : `Reactivate "${warehouseName}"?`;
    if (!confirm(message)) return;
    startTransition(async () => {
      const result = await submitSetWarehouseActive(warehouseId, !isActive);
      if (!result.ok) {
        alert(`Error updating warehouse: ${result.error}`);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="rounded-lg px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40"
      style={{ color: isActive ? "var(--error)" : "var(--green-900)" }}
    >
      {isPending ? "Saving…" : isActive ? "Deactivate" : "Reactivate"}
    </button>
  );
}
