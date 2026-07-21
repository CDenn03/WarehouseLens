"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { submitNewSupplier } from "@/features/procurement/actions/procurementActions";

const emptyForm = { name: "", contact_email: "", lead_time_days: "" };

export function NewSupplierModal() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const close = () => {
    setOpen(false);
    setForm(emptyForm);
    setError(null);
  };

  const handleSubmit = () => {
    setError(null);
    startTransition(async () => {
      const result = await submitNewSupplier({
        name: form.name.trim(),
        contact_email: form.contact_email.trim() || undefined,
        lead_time_days: form.lead_time_days.trim()
          ? Number(form.lead_time_days)
          : undefined,
      });
      if (result.ok) {
        close();
      } else {
        setError(result.error ?? "Could not create the supplier.");
      }
    });
  };

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        New supplier
      </Button>
      <Modal open={open} onClose={close} title="New supplier">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit();
          }}
        >
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Acme Industrial Supply"
            required
          />
          <Input
            label="Contact email (optional)"
            type="email"
            value={form.contact_email}
            onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
            placeholder="orders@acme.example"
          />
          <Input
            label="Lead time in days (optional)"
            type="number"
            min="0"
            value={form.lead_time_days}
            onChange={(e) => setForm({ ...form, lead_time_days: e.target.value })}
            placeholder="e.g. 5"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={close} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isPending}>
              Create supplier
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
