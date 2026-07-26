"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { ActionButton } from "@/components/ActionButton";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { submitDeleteUser } from "@/features/admin/actions/adminActions";

interface Props {
  userId: string;
  username: string | null;
  email: string;
  isDeleted: boolean;
}

export function DeleteUserButton({
  userId,
  username,
  email,
  isDeleted,
}: Props) {
  const [open, setOpen] = useState(false);

  async function handleConfirm() {
    const result = await submitDeleteUser(userId);
    if (!result.ok) {
      alert(`Error deleting user: ${result.error}`);
    }
  }

  if (isDeleted) return null;

  return (
    <>
      <ActionButton
        icon={<Trash2 className="h-4 w-4" style={{ color: "var(--error)" }} />}
        label="Delete user"
        onClick={() => setOpen(true)}
        variant="danger"
      />
      <ConfirmDeleteDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={handleConfirm}
        title="Delete User"
        description={`Soft-delete user "${username || email}"? They will be unable to sign in until restored.`}
        confirmLabel="Delete User"
      />
    </>
  );
}
