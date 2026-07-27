"use client";

import { useCallback, useRef, useState, useTransition } from "react";
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
  holdDuration?: number;
}

const HOLD_DURATION_DEFAULT = 2500;

export function ConfirmDeleteDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Delete",
  variant = "danger",
  holdDuration = HOLD_DURATION_DEFAULT,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimer = useRef<ReturnType<typeof setInterval>>(null);
  const startTime = useRef<number>(0);
  const completed = useRef(false);

  const cleanup = useCallback(() => {
    if (holdTimer.current) {
      clearInterval(holdTimer.current);
      holdTimer.current = null;
    }
  }, []);

  function startHold() {
    if (isPending) return;
    completed.current = false;
    startTime.current = Date.now();
    setHoldProgress(0);

    holdTimer.current = setInterval(() => {
      const elapsed = Date.now() - startTime.current;
      const progress = Math.min(elapsed / holdDuration, 1);
      setHoldProgress(progress);

      if (progress >= 1) {
        cleanup();
        completed.current = true;
        setHoldProgress(1);
        handleConfirm();
      }
    }, 16);
  }

  function endHold() {
    if (completed.current) return;
    cleanup();
    setHoldProgress(0);
  }

  function handleConfirm() {
    startTransition(async () => {
      await onConfirm();
      onClose();
    });
  }

  function handleOpenChange() {
    cleanup();
    setHoldProgress(0);
    completed.current = false;
  }

  return (
    <Modal
      open={open}
      onClose={isPending ? () => {} : () => { handleOpenChange(); onClose(); }}
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
        <p className="text-xs" style={{ color: "var(--ink-mute)" }}>
          Press and hold the button below for 2.5 seconds to confirm.
        </p>
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => { handleOpenChange(); onClose(); }}
            disabled={isPending}
          >
            Cancel
          </Button>
          <button
            type="button"
            onMouseDown={startHold}
            onMouseUp={endHold}
            onMouseLeave={endHold}
            onTouchStart={startHold}
            onTouchEnd={endHold}
            disabled={isPending}
            className="relative overflow-hidden rounded-full px-3.5 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background: holdProgress >= 1 ? "var(--error)" : "var(--error-light)",
              color: holdProgress >= 1 ? "#fff" : "var(--error)",
              minWidth: 120,
            }}
          >
            {/* Progress fill */}
            <span
              className="absolute inset-0 origin-left transition-none"
              style={{
                background: "var(--error)",
                transform: `scaleX(${holdProgress})`,
              }}
            />
            <span className="relative z-10 flex items-center justify-center gap-2">
              {isPending ? (
                <>
                  <svg
                    className="h-4 w-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                  </svg>
                  Deleting...
                </>
              ) : (
                confirmLabel
              )}
            </span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
