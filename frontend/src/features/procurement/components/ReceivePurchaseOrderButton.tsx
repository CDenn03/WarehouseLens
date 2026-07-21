"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/Button";
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
      <Button
        size="sm"
        variant="secondary"
        isLoading={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await submitReceivePurchaseOrder(purchaseOrderId);
            if (!result.ok) {
              setError(result.error ?? "Could not receive this PO.");
            }
          });
        }}
      >
        Receive
      </Button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
