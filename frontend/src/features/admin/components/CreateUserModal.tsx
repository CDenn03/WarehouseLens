"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { submitCreateUser } from "@/features/admin/actions/adminActions";

export function CreateUserModal() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpen() {
    setEmail("");
    setUsername("");
    setError(null);
    setOpen(true);
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await submitCreateUser(email, username || undefined);
      if (!result.ok) {
        setError(result.error ?? "Unknown error");
        return;
      }
      setOpen(false);
    });
  }

  return (
    <>
      <Button onClick={handleOpen}>+ Add User</Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Create User"
        description="Provisions a Keycloak account with a temporary password."
      >
        <div className="space-y-4">
          <Input
            label="Email"
            type="email"
            placeholder="user@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Username (optional)"
            placeholder="jdoe"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
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
              disabled={!email.trim() || isPending}
              isLoading={isPending}
            >
              Create
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
