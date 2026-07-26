"use client";

import { useState, useTransition } from "react";
import { PackageCheck } from "lucide-react";
import { ActionButton } from "@/components/ActionButton";
import { submitReceivePurchaseOrder } from "@/features/procurement/actions/procurementActions";

export function ReceivePurchaseOrderButton({
  purchaseOrderId,
}: {
  purchaseOrderId: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-end gap-1">
      <ActionButton
        icon={<PackageCheck className="h-4 w-4" style={{ color: "var(--green-900)" }} />}
        label="Receive"
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await submitReceivePurchaseOrder(purchaseOrderId);
            if (!result.ok) {
              setError(result.error ?? "Could not receive this PO.");
            }
          });
        }}
        disabled={isPending}
      />
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}
