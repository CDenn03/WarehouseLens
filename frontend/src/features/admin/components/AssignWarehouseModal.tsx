"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";
import { submitAssignWarehouse } from "@/features/admin/actions/adminActions";
import type { IamUserRead } from "@/features/admin/types";
import type { Warehouse } from "@/features/inventory/types";

interface Props {
  user: IamUserRead;
  warehouses: Warehouse[];
}

export function AssignWarehouseModal({ user, warehouses }: Props) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Only show warehouses the user isn't already assigned to.
  const assignedIds = new Set(user.warehouse_assignments.map((a) => a.warehouse_id));
  const available = warehouses.filter((w) => !assignedIds.has(String(w.id)));

  function handleOpen() {
    setSelectedId("");
    setError(null);
    setOpen(true);
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await submitAssignWarehouse(user.id, selectedId);
      if (!result.ok) {
        setError(result.error ?? "Unknown error");
        return;
      }
      setOpen(false);
    });
  }

  // If the user has global access don't offer the picker — they can see
  // everything already.
  if (user.has_global_warehouse_access) {
    return null;
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={handleOpen}>
        + Assign warehouse
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Assign warehouse — ${user.username || user.email}`}
      >
        <div className="space-y-4">
          {available.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--ink-mute)" }}>
              All warehouses in this tenant are already assigned to this user.
            </p>
          ) : (
            <>
              <Select
                label="Warehouse"
                placeholder="Select a warehouse…"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                options={available.map((w) => ({
                  value: String(w.id),
                  label: w.name,
                }))}
              />
              {error && (
                <p
                  className="rounded-lg px-3 py-2 text-sm"
                  style={{
                    background: "var(--error-light)",
                    color: "var(--error-text)",
                    border: "1px solid var(--error-border)",
                  }}
                >
                  {error}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setOpen(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!selectedId || isPending}
                  isLoading={isPending}
                >
                  Assign
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
