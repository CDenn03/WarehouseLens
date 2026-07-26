"use client";

import { useState } from "react";
import { UserMinus, KeyRound } from "lucide-react";
import { ActionButton } from "@/components/ActionButton";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Modal } from "@/components/Modal";
import { Pagination } from "@/components/Pagination";
import { SearchInput } from "@/components/SearchInput";
import { useTableData } from "@/hooks/useTableData";
import { formatDateTime } from "@/lib/utils";
import {
  submitResetPlatformAdminPassword,
  submitRevokePlatformAdmin,
} from "@/features/platform/actions/platformActions";
import { CredentialNotice } from "@/features/platform/components/CredentialNotice";
import { PlatformAdminFormModal } from "@/features/platform/components/PlatformAdminFormModal";
import type { PlatformAdminRead } from "@/features/platform/types";

interface Props {
  currentUserId: string;
}

type Dialog = { kind: "reset" | "revoke"; admin: PlatformAdminRead } | null;

export function PlatformAdminsClient({ currentUserId }: Props) {
  const {
    data: admins,
    total,
    page,
    totalPages,
    isLoading,
    error: fetchError,
    search,
    setSearch,
    goToPage,
  } = useTableData<PlatformAdminRead>("/platform/admins", {
    pageSize: 20,
    defaultSortBy: "assigned_at",
    defaultSortOrder: "desc",
  });

  const [dialog, setDialog] = useState<Dialog>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  function close() {
    setDialog(null);
    setActionError(null);
    setNewPassword(null);
  }

  function open(kind: "reset" | "revoke", admin: PlatformAdminRead) {
    setActionError(null);
    setNewPassword(null);
    setDialog({ kind, admin });
  }

  async function handleReset(userId: string) {
    setActionError(null);
    setIsPending(true);
    try {
      const result = await submitResetPlatformAdminPassword(userId);
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      setNewPassword(result.data.temporary_password);
    } finally {
      setIsPending(false);
    }
  }

  async function handleRevoke(userId: string) {
    setActionError(null);
    setIsPending(true);
    try {
      const result = await submitRevokePlatformAdmin(userId);
      if (!result.ok) {
        setActionError(result.error ?? "Unknown error");
        return;
      }
      close();
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card title="Platform administrators" description="Users with the platform_admin role">
        <div
          className="flex items-center gap-4 border-b px-4 py-3"
          style={{ borderColor: "var(--border-soft)" }}
        >
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search admins..."
            className="flex-1"
          />
          <PlatformAdminFormModal />
        </div>
        {(fetchError || actionError) && (
          <div className="px-4 py-3 text-sm" style={{ color: "var(--error)" }}>
            {fetchError ?? actionError}
          </div>
        )}
        {admins.length === 0 && !isLoading ? (
          <p className="py-4 text-center text-sm italic" style={{ color: "var(--ink-mute)" }}>
            {search ? `No admins match "${search}".` : "No platform admins found."}
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
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          onPageChange={goToPage}
        />
      </Card>

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
          {actionError && (
            <p
              className="rounded-lg px-3 py-2 text-sm"
              style={{
                background: "var(--error-light)",
                color: "var(--error-text)",
                border: "1px solid var(--error-border)",
              }}
            >
              {actionError}
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
          {actionError && (
            <p
              className="rounded-lg px-3 py-2 text-sm"
              style={{
                background: "var(--error-light)",
                color: "var(--error-text)",
                border: "1px solid var(--error-border)",
              }}
            >
              {actionError}
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
    </div>
  );
}
