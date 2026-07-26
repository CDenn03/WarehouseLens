"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { ActionButton } from "@/components/ActionButton";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import {
  submitCreatePlatformAdmin,
  submitUpdatePlatformAdmin,
} from "@/features/platform/actions/platformActions";
import { CredentialNotice } from "@/features/platform/components/CredentialNotice";
import type { PlatformAdminRead } from "@/features/platform/types";

interface Props {
  /** Omit to add a new platform admin; pass one to edit it. */
  admin?: PlatformAdminRead;
}

/**
 * Add or edit a platform admin.
 *
 * Adding by email provisions a Keycloak account and returns a one-time
 * temporary password. Editing writes through to Keycloak, which owns the
 * identity — the local record follows it.
 */
export function PlatformAdminFormModal({ admin }: Props) {
  const isEdit = admin !== undefined;

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(admin?.email ?? "");
  const [username, setUsername] = useState(admin?.username ?? "");
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ email: string; password: string | null } | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();

  function handleOpen() {
    setEmail(admin?.email ?? "");
    setUsername(admin?.username ?? "");
    setError(null);
    setIssued(null);
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
    setIssued(null);
  }

  const trimmedEmail = email.trim();
  const trimmedUsername = username.trim();
  const emailChanged = trimmedEmail.toLowerCase() !== (admin?.email ?? "").toLowerCase();
  const usernameChanged = trimmedUsername !== (admin?.username ?? "");
  const canSubmit = isEdit
    ? Boolean(trimmedEmail) && (emailChanged || usernameChanged)
    : Boolean(trimmedEmail);

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      if (isEdit) {
        const result = await submitUpdatePlatformAdmin(admin.id, {
          ...(emailChanged ? { email: trimmedEmail } : {}),
          ...(usernameChanged ? { username: trimmedUsername } : {}),
        });
        if (!result.ok) {
          setError(result.error ?? "Unknown error");
          return;
        }
        handleClose();
        return;
      }

      const result = await submitCreatePlatformAdmin({
        email: trimmedEmail,
        ...(trimmedUsername ? { username: trimmedUsername } : {}),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setIssued({
        email: result.data.admin.email,
        password: result.data.temporary_password,
      });
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
        <Button size="sm" onClick={handleOpen}>
          + Add admin
        </Button>
      )}

      <Modal
        open={open}
        onClose={handleClose}
        title={isEdit ? "Edit platform admin" : "Add platform admin"}
        description={
          isEdit
            ? "Changes are written to Keycloak and mirrored here."
            : "Provisions an account with platform-wide administrative access."
        }
      >
        {issued ? (
          <div className="space-y-4">
            <CredentialNotice
              email={issued.email}
              password={issued.password}
              existingAccountHint="They were granted the Platform Admin role with their existing sign-in."
            />
            <div className="flex justify-end">
              <Button onClick={handleClose}>Done</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@warehouselens.com"
              autoFocus
            />
            <Input
              label="Username (optional)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Defaults to the part before @"
            />
            {!isEdit && (
              <p className="text-xs" style={{ color: "var(--ink-mute)" }}>
                They receive a temporary password and must change it at first
                login. An email that already has an account keeps its password.
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
              <Button variant="secondary" onClick={handleClose} disabled={isPending}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit || isPending}
                isLoading={isPending}
              >
                {isEdit ? "Save changes" : "Add admin"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
