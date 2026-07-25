"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { submitCreateTenant } from "@/features/platform/actions/platformActions";

export function CreateTenantModal() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpen() {
    setName("");
    setEmail("");
    setError(null);
    setOpen(true);
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await submitCreateTenant({
        name: name.trim(),
        superuser_email: email.trim() || undefined,
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
      <Button onClick={handleOpen}>+ New tenant</Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Create tenant"
        description="Provision a new tenant. The superuser email determines who bootstraps as tenant admin on first login."
      >
        <div className="space-y-4">
          <Input
            label="Tenant name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="acme-corp"
            autoFocus
          />
          <Input
            label="Superuser email (optional)"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@acme-corp.com"
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
