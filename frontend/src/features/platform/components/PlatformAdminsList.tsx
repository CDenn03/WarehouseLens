"use client";

import { useTransition } from "react";
import { formatDateTime } from "@/lib/utils";
import { submitRevokePlatformAdmin } from "@/features/platform/actions/platformActions";
import type { PlatformAdminRead } from "@/features/platform/types";

interface Props {
  admins: PlatformAdminRead[];
  currentUserId: string;
}

export function PlatformAdminsList({ admins, currentUserId }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleRevoke(userId: string) {
    if (!confirm("Revoke platform admin access for this user?")) return;
    startTransition(async () => {
      const result = await submitRevokePlatformAdmin(userId);
      if (!result.ok) alert(`Error: ${result.error}`);
    });
  }

  if (admins.length === 0) {
    return (
      <p className="py-4 text-sm italic" style={{ color: "var(--ink-mute)" }}>
        No platform admins found.
      </p>
    );
  }

  return (
    <ul className="divide-y" style={{ borderColor: "var(--border-soft)" }}>
      {admins.map((admin) => (
        <li
          key={admin.id}
          className="flex items-center justify-between gap-4 py-3"
        >
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
              {admin.username ?? admin.email}
            </p>
            <p className="text-xs" style={{ color: "var(--ink-mute)" }}>
              {admin.email}
              {admin.assigned_at && ` · assigned ${formatDateTime(admin.assigned_at)}`}
            </p>
          </div>
          {admin.id !== currentUserId && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleRevoke(admin.id)}
              className="text-xs font-medium transition-colors hover:underline disabled:opacity-40"
              style={{ color: "var(--error)" }}
            >
              Revoke
            </button>
          )}
          {admin.id === currentUserId && (
            <span className="text-xs" style={{ color: "var(--ink-mute)" }}>
              (you)
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
