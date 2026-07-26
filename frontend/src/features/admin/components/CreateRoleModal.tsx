"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { submitCreateRole } from "@/features/admin/actions/adminActions";
import { PermissionSelector } from "@/features/admin/components/PermissionSelector";

export function CreateRoleModal() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [permissionIds, setPermissionIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpen() {
    setName("");
    setPermissionIds([]);
    setError(null);
    setOpen(true);
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await submitCreateRole(name, undefined, permissionIds);
      if (!result.ok) {
        setError(result.error ?? "Unknown error");
        return;
      }
      setOpen(false);
    });
  }

  return (
    <>
      <Button onClick={handleOpen}>+ Add Role</Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Create Role"
        description="Define a new role and assign permissions."
        widthClassName="max-w-3xl"
      >
        <div className="space-y-4">
          <Input
            label="Role Name"
            placeholder="e.g. Warehouse Manager"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <PermissionSelector value={permissionIds} onChange={setPermissionIds} />
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
