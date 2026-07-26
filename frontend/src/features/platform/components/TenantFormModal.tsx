"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { ActionButton } from "@/components/ActionButton";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import {
  submitCreateTenant,
  submitUpdateTenant,
} from "@/features/platform/actions/platformActions";
import { CredentialNotice } from "@/features/platform/components/CredentialNotice";
import type {
  ProvisionedAdminRead,
  TenantRead,
} from "@/features/platform/types";

interface Props {
  /** Omit to create a new tenant; pass a tenant to edit it. */
  tenant?: TenantRead;
}

/**
 * Create or edit a tenant.
 *
 * Creating one provisions its admin account, so the modal has a second step:
 * the credentials the platform admin has to pass on. Editing reuses the same
 * form — changing the admin email provisions that person too.
 */
export function TenantFormModal({ tenant }: Props) {
  const isEdit = tenant !== undefined;

  const [open, setOpen] = useState(false);
  const [name, setName] = useState(tenant?.name ?? "");
  const [email, setEmail] = useState(tenant?.admin_email ?? "");
  const [error, setError] = useState<string | null>(null);
  const [provisioned, setProvisioned] = useState<ProvisionedAdminRead | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpen() {
    setName(tenant?.name ?? "");
    setEmail(tenant?.admin_email ?? "");
    setError(null);
    setProvisioned(null);
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
    setProvisioned(null);
  }

  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  const emailChanged =
    trimmedEmail.toLowerCase() !== (tenant?.admin_email ?? "").toLowerCase();
  const nameChanged = trimmedName !== (tenant?.name ?? "");
  const canSubmit = isEdit
    ? Boolean(trimmedName) && (nameChanged || (Boolean(trimmedEmail) && emailChanged))
    : Boolean(trimmedName) && Boolean(trimmedEmail);

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = isEdit
        ? await submitUpdateTenant(tenant.id, {
            ...(nameChanged ? { name: trimmedName } : {}),
            ...(emailChanged && trimmedEmail ? { admin_email: trimmedEmail } : {}),
          })
        : await submitCreateTenant({
            name: trimmedName,
            admin_email: trimmedEmail,
          });

      if (!result.ok) {
        setError(result.error);
        return;
      }
      // An admin is only returned when this call provisioned one.
      if (result.data.admin) {
        setProvisioned(result.data.admin);
        return;
      }
      handleClose();
    });
  }

  return (
    <>
      {isEdit ? (
        <ActionButton
          icon={<Pencil className="h-4 w-4" style={{ color: "var(--ink-soft)" }} />}
          label="Edit"
          onClick={handleOpen}
        />
      ) : (
        <Button onClick={handleOpen}>+ New tenant</Button>
      )}

      <Modal
        open={open}
        onClose={handleClose}
        title={isEdit ? `Edit ${tenant.name}` : "Create tenant"}
        description={
          isEdit
            ? "Rename the tenant or hand it to a new admin."
            : "The admin email becomes the tenant's first user, with the Tenant Admin role."
        }
      >
        {provisioned ? (
          <div className="space-y-4">
            <CredentialNotice
              email={provisioned.email}
              password={provisioned.temporary_password}
              existingAccountHint="They were granted Tenant Admin on this tenant with their existing sign-in."
            />
            <div className="flex justify-end">
              <Button onClick={handleClose}>Done</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Input
              label="Tenant name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="acme-corp"
              autoFocus
            />
            <Input
              label="Admin email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@acme-corp.com"
            />
            <p className="text-xs" style={{ color: "var(--ink-mute)" }}>
              {isEdit
                ? "Changing the admin email provisions that person as an additional Tenant Admin. The current admin keeps their access."
                : "We create their account and issue a temporary password, which they must change at first login."}
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
              <Button variant="secondary" onClick={handleClose} disabled={isPending}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit || isPending}
                isLoading={isPending}
              >
                {isEdit ? "Save changes" : "Create"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
