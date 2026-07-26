"use client";

import { useState, useTransition } from "react";
import { Pencil, KeyRound, Trash2 } from "lucide-react";
import { ActionButton } from "@/components/ActionButton";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import {
  submitDeleteTenant,
  submitResetTenantAdminPassword,
} from "@/features/platform/actions/platformActions";
import { CredentialNotice } from "@/features/platform/components/CredentialNotice";
import { TenantFormModal } from "@/features/platform/components/TenantFormModal";
import type { TenantRead } from "@/features/platform/types";

interface Props {
  tenant: TenantRead;
}

type Dialog = "none" | "reset" | "delete";

/** Edit / reset-password / delete for one tenant row. */
export function TenantRowActions({ tenant }: Props) {
  const [dialog, setDialog] = useState<Dialog>("none");
  const [error, setError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function close() {
    setDialog("none");
    setError(null);
    setNewPassword(null);
  }

  function open(next: Dialog) {
    setError(null);
    setNewPassword(null);
    setDialog(next);
  }

  function handleReset() {
    setError(null);
    startTransition(async () => {
      const result = await submitResetTenantAdminPassword(tenant.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNewPassword(result.data.temporary_password);
    });
  }

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await submitDeleteTenant(tenant.id);
      if (!result.ok) {
        setError(result.error ?? "Unknown error");
        return;
      }
      close();
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <TenantFormModal tenant={tenant} />

      <ActionButton
        icon={<KeyRound className="h-4 w-4" style={{ color: "var(--ink-soft)" }} />}
        label={tenant.admin_email ? "Reset password" : "No admin email"}
        onClick={() => open("reset")}
        disabled={!tenant.admin_email}
      />

      <ActionButton
        icon={<Trash2 className="h-4 w-4" style={{ color: "var(--error)" }} />}
        label="Delete"
        onClick={() => open("delete")}
        variant="danger"
      />

      <Modal
        open={dialog === "reset"}
        onClose={close}
        title={`Reset admin password — ${tenant.name}`}
        description={`Issues a new temporary password for ${tenant.admin_email ?? "the tenant admin"}.`}
      >
        <div className="space-y-4">
          {newPassword ? (
            <CredentialNotice
              email={tenant.admin_email ?? ""}
              password={newPassword}
            />
          ) : (
            <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
              Their current password stops working immediately, and they will be
              asked to choose a new one at their next sign-in.
            </p>
          )}
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
            {newPassword ? (
              <Button onClick={close}>Done</Button>
            ) : (
              <>
                <Button variant="secondary" onClick={close} disabled={isPending}>
                  Cancel
                </Button>
                <Button onClick={handleReset} disabled={isPending} isLoading={isPending}>
                  Reset password
                </Button>
              </>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        open={dialog === "delete"}
        onClose={close}
        title={`Delete ${tenant.name}?`}
        description="This removes the tenant, its memberships and its role assignments."
      >
        <div className="space-y-4">
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
            {tenant.user_count} user{tenant.user_count === 1 ? "" : "s"} will lose
            access to this tenant. Anyone left without a tenant is deactivated.
            Tenants that still own warehouses cannot be deleted.
          </p>
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
            <Button variant="secondary" onClick={close} disabled={isPending}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              disabled={isPending}
              isLoading={isPending}
            >
              Delete tenant
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
