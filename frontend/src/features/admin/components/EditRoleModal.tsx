"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { ActionButton } from "@/components/ActionButton";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { submitUpdateRole } from "@/features/admin/actions/adminActions";
import { getRoleDetail } from "@/features/admin/services/adminService";
import { PermissionSelector } from "@/features/admin/components/PermissionSelector";
import type { RoleRead } from "@/features/admin/types";

interface Props {
  role: RoleRead;
}

export function EditRoleModal({ role }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(role.name);
  const [permissionIds, setPermissionIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpen() {
    setName(role.name);
    setError(null);
    setOpen(true);
    getRoleDetail(role.id).then((detail) => {
      setPermissionIds(detail.permissions.map((p) => p.id));
    });
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await submitUpdateRole(role.id, name, permissionIds);
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
        label="Edit role"
        onClick={handleOpen}
      />
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Edit Role — ${role.name}`}
        widthClassName="max-w-3xl"
      >
        <div className="space-y-4">
          <Input
            label="Role Name"
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
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
