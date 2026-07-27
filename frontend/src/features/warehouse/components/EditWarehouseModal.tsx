"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { ActionButton } from "@/components/ActionButton";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { submitUpdateWarehouse } from "@/features/warehouse/actions/warehouseActions";
import type { Warehouse } from "@/features/inventory/types";

export function EditWarehouseModal({ warehouse }: { warehouse: Warehouse }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(warehouse.name);
  const [address, setAddress] = useState(warehouse.address ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpen() {
    setName(warehouse.name);
    setAddress(warehouse.address ?? "");
    setError(null);
    setOpen(true);
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await submitUpdateWarehouse(warehouse.id, {
        name,
        address: address.trim() || undefined,
      });
      if (!result.ok) {
        setError(result.error ?? "Unknown error");
        return;
      }
      setOpen(false);
    });
  }

  return (
    <>
      <ActionButton
        icon={<Pencil className="h-4 w-4" style={{ color: "var(--ink-soft)" }} />}
        label="Edit warehouse"
        onClick={handleOpen}
      />
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Edit Warehouse — ${warehouse.name}`}
      >
        <div className="space-y-4">
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label="Address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
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
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!name.trim() || isPending} isLoading={isPending}>
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
