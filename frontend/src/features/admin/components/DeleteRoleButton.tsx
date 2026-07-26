"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { ActionButton } from "@/components/ActionButton";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { submitDeleteRole } from "@/features/admin/actions/adminActions";

interface Props {
  roleId: string;
  roleName: string;
  disabled?: boolean;
  disabledReason?: string;
}

export function DeleteRoleButton({
  roleId,
  roleName,
  disabled = false,
  disabledReason,
}: Props) {
  const [open, setOpen] = useState(false);

  async function handleConfirm() {
    const result = await submitDeleteRole(roleId);
    if (!result.ok) {
      alert(`Error deleting role: ${result.error}`);
    }
  }

  return (
    <>
      <ActionButton
        icon={
          <Trash2 className="h-4 w-4" style={{ color: disabled ? "var(--ink-mute)" : "var(--error)" }} />
        }
        label={disabled && disabledReason ? disabledReason : "Delete role"}
        onClick={() => setOpen(true)}
        variant={disabled ? "default" : "danger"}
        disabled={disabled}
      />
      <ConfirmDeleteDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={handleConfirm}
        title="Delete Role"
        description={`Delete role "${roleName}"? Users with this role will lose its permissions.`}
        confirmLabel="Delete Role"
      />
    </>
  );
}
