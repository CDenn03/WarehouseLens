"use client";

import { useState, useTransition } from "react";
import { Pencil, KeyRound, UserMinus } from "lucide-react";
import { ActionButton } from "@/components/ActionButton";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { formatDateTime } from "@/lib/utils";
import {
  submitResetPlatformAdminPassword,
  submitRevokePlatformAdmin,
} from "@/features/platform/actions/platformActions";
import { CredentialNotice } from "@/features/platform/components/CredentialNotice";
import { PlatformAdminFormModal } from "@/features/platform/components/PlatformAdminFormModal";
import type { PlatformAdminRead } from "@/features/platform/types";

interface Props {
  admins: PlatformAdminRead[];
  currentUserId: string;
}

type Dialog = { kind: "reset" | "revoke"; admin: PlatformAdminRead } | null;

export function PlatformAdminsList({ admins, currentUserId }: Props) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const [error, setError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function close() {
    setDialog(null);
    setError(null);
    setNewPassword(null);
  }

  function open(kind: "reset" | "revoke", admin: PlatformAdminRead) {
    setError(null);
    setNewPassword(null);
    setDialog({ kind, admin });
  }

  function handleReset(userId: string) {
    setError(null);
    startTransition(async () => {
      const result = await submitResetPlatformAdminPassword(userId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNewPassword(result.data.temporary_password);
    });
  }

  function handleRevoke(userId: string) {
    setError(null);
    startTransition(async () => {
      const result = await submitRevokePlatformAdmin(userId);
      if (!result.ok) {
        setError(result.error ?? "Unknown error");
        return;
      }
      close();
    });
  }

  return (
    <>
      {admins.length === 0 ? (
        <p className="py-4 text-sm italic" style={{ color: "var(--ink-mute)" }}>
          No platform admins found.
        </p>
      ) : (
        <ul className="divide-y" style={{ borderColor: "var(--border-soft)" }}>
          {admins.map((admin) => (
            <li
              key={admin.id}
              className="flex items-start justify-between gap-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
                  {admin.username ?? admin.email}
                  {admin.id === currentUserId && (
                    <span
                      className="ml-2 text-xs font-normal"
                      style={{ color: "var(--ink-mute)" }}
                    >
                      (you)
                    </span>
                  )}
                </p>
                <p className="truncate text-xs" style={{ color: "var(--ink-mute)" }}>
                  {admin.email}
                  {admin.assigned_at &&
                    ` · assigned ${formatDateTime(admin.assigned_at)}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <PlatformAdminFormModal admin={admin} />
                <ActionButton
                  icon={<KeyRound className="h-4 w-4" style={{ color: "var(--ink-soft)" }} />}
                  label="Reset password"
                  onClick={() => open("reset", admin)}
                />
                {admin.id !== currentUserId && (
                  <ActionButton
                    icon={<UserMinus className="h-4 w-4" style={{ color: "var(--error)" }} />}
                    label="Revoke"
                    onClick={() => open("revoke", admin)}
                    variant="danger"
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={dialog?.kind === "reset"}
        onClose={close}
        title="Reset password"
        description={
          dialog ? `Issues a new temporary password for ${dialog.admin.email}.` : ""
        }
      >
        <div className="space-y-4">
          {newPassword && dialog ? (
            <CredentialNotice email={dialog.admin.email} password={newPassword} />
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
                <Button
                  onClick={() => dialog && handleReset(dialog.admin.id)}
                  disabled={isPending}
                  isLoading={isPending}
                >
                  Reset password
                </Button>
              </>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        open={dialog?.kind === "revoke"}
        onClose={close}
        title="Revoke platform admin"
        description={
          dialog
            ? `${dialog.admin.email} loses platform-wide administrative access.`
            : ""
        }
      >
        <div className="space-y-4">
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
            Their account stays active — only the platform_admin role is removed.
            The last remaining platform admin cannot be revoked.
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
              onClick={() => dialog && handleRevoke(dialog.admin.id)}
              disabled={isPending}
              isLoading={isPending}
            >
              Revoke
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
