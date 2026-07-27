"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { ActionButton } from "@/components/ActionButton";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { submitUpdateUser } from "@/features/admin/actions/adminActions";
import { RoleCombobox } from "@/features/admin/components/RoleCombobox";
import type { IamUserRead, RoleRead } from "@/features/admin/types";

interface Props {
  user: IamUserRead;
  roles: RoleRead[];
}

export function EditUserModal({ user, roles }: Props) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(user.email);
  const [username, setUsername] = useState(user.username ?? "");
  const [roleSlug, setRoleSlug] = useState<string | null>(
    user.roles[0]?.slug ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpen() {
    setEmail(user.email);
    setUsername(user.username ?? "");
    setRoleSlug(user.roles[0]?.slug ?? null);
    setError(null);
    setOpen(true);
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await submitUpdateUser(user.id, {
        email: email || undefined,
        username: username || undefined,
        roleSlug: roleSlug || undefined,
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
        label="Edit user"
        onClick={handleOpen}
      />
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Edit User — ${user.username || user.email}`}
      >
        <div className="space-y-4">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <RoleCombobox
            value={roleSlug}
            onChange={setRoleSlug}
            roles={roles}
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
              disabled={!email.trim() || isPending}
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
