"use client";

import { useTransition } from "react";
import { submitRevokeRole } from "@/features/admin/actions/adminActions";

interface Props {
  userId: string;
  roleSlug: string;
}

export function RevokeRoleButton({ userId, roleSlug }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (
      !confirm(
        `Revoke role "${roleSlug}"? This might prevent the user from performing certain actions.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await submitRevokeRole(userId, roleSlug);
      if (!result.ok) {
        alert(`Error revoking role: ${result.error}`);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="flex h-5 w-5 items-center justify-center rounded-full transition-colors hover:bg-error/20 disabled:opacity-40"
      style={{ color: "var(--error)" }}
      aria-label={`Revoke ${roleSlug}`}
    >
      <svg
        className="h-3.5 w-3.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );
}
