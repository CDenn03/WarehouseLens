"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";
import { submitAssignRole } from "@/features/admin/actions/adminActions";
import type { IamUserRead, RoleRead } from "@/features/admin/types";

interface Props {
  user: IamUserRead;
  roles: RoleRead[];
}

export function AssignRoleModal({ user, roles }: Props) {
  const [open, setOpen] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Only show roles the user doesn't already have.
  const assignedSlugs = new Set(user.roles.map((r) => r.slug));
  const available = roles.filter((r) => !assignedSlugs.has(r.slug));

  function handleOpen() {
    setSelectedSlug("");
    setError(null);
    setOpen(true);
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await submitAssignRole(user.id, selectedSlug);
      if (!result.ok) {
        setError(result.error ?? "Unknown error");
        return;
      }
      setOpen(false);
    });
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={handleOpen}>
        + Assign role
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Assign role — ${user.username || user.email}`}
      >
        <div className="space-y-4">
          {available.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--ink-mute)" }}>
              All roles are already assigned to this user.
            </p>
          ) : (
            <>
              <Select
                label="Role"
                placeholder="Select a role…"
                value={selectedSlug}
                onChange={(e) => setSelectedSlug(e.target.value)}
                options={available.map((r) => ({
                  value: r.slug,
                  label: r.name,
                }))}
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
                  disabled={!selectedSlug || isPending}
                  isLoading={isPending}
                >
                  Assign
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
