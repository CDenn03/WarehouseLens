"use client";

import { useTransition } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title: string;
  description: string;
  confirmLabel?: string;
  variant?: "danger" | "warning";
}

export function ConfirmDeleteDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Delete",
  variant = "danger",
}: Props) {
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      await onConfirm();
      onClose();
    });
  }

  return (
      <Modal
        open={open}
        onClose={isPending ? () => {} : onClose}
        title={title}
        widthClassName="max-w-md"
      >
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{
              background:
                variant === "danger"
                  ? "var(--error-light)"
                  : "var(--warning-light, #fef3c7)",
            }}
          >
            <AlertTriangle
              className="h-5 w-5"
              style={{
                color:
                  variant === "danger"
                    ? "var(--error)"
                    : "var(--warning, #f59e0b)",
              }}
            />
          </div>
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
            {description}
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirm}
            disabled={isPending}
            isLoading={isPending}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
