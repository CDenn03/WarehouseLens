"use client";

import { useTransition } from "react";
import { submitRevokeWarehouse } from "@/features/admin/actions/adminActions";

interface Props {
  userId: string;
  warehouseId: string;
}

export function RevokeWarehouseButton({ userId, warehouseId }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (
      !confirm(
        "Revoke this warehouse assignment? The user will no longer be able to access this warehouse.",
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await submitRevokeWarehouse(userId, warehouseId);
      if (!result.ok) {
        alert(`Error revoking warehouse: ${result.error}`);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="rounded-lg px-2.5 py-1 text-xs font-medium transition-colors hover:bg-error/10 disabled:opacity-40"
      style={{ color: "var(--error)" }}
      aria-label="Revoke warehouse assignment"
    >
      {isPending ? "Revoking…" : "Revoke"}
    </button>
  );
}
