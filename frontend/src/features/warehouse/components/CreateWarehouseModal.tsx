"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { submitCreateWarehouse } from "@/features/warehouse/actions/warehouseActions";

export function CreateWarehouseModal() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpen() {
    setName("");
    setAddress("");
    setError(null);
    setOpen(true);
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await submitCreateWarehouse({
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
      <Button onClick={handleOpen}>+ Add Warehouse</Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Create Warehouse"
        description="Register a new warehouse location."
      >
        <div className="space-y-4">
          <Input
            label="Name"
            placeholder="e.g. Nairobi Central"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label="Address"
            placeholder="e.g. Industrial Area, Nairobi"
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
            <Button
              variant="secondary"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!name.trim() || isPending}
              isLoading={isPending}
            >
              Create
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
