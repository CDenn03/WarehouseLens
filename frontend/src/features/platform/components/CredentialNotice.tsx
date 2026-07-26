"use client";

import { useState } from "react";

interface Props {
  email: string;
  /** Null when the account already existed — its owner keeps their password. */
  password: string | null;
  /** Copy shown when no new password was issued. */
  existingAccountHint?: string;
}

/**
 * One-time display of a provisioned account's temporary password.
 *
 * The backend returns the password exactly once, on the request that created
 * the account; there is no way to read it back afterwards, so the panel says so
 * plainly and offers a copy button rather than expecting anyone to transcribe it.
 */
export function CredentialNotice({ email, password, existingAccountHint }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure origin / denied permission) — the password
      // is on screen either way, so this is not worth surfacing as an error.
    }
  }

  if (!password) {
    return (
      <div
        className="rounded-lg px-3 py-3 text-sm"
        style={{
          background: "var(--bg-alt)",
          border: "1px solid var(--border-soft)",
          color: "var(--ink-soft)",
        }}
      >
        <p className="font-medium" style={{ color: "var(--ink)" }}>
          {email} already has an account
        </p>
        <p className="mt-1 text-xs" style={{ color: "var(--ink-mute)" }}>
          {existingAccountHint ??
            "Their existing password still works — no new credentials were issued."}
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg px-3 py-3 text-sm"
      style={{
        background: "var(--green-050)",
        border: "1px solid var(--border-soft)",
      }}
    >
      <p className="font-medium" style={{ color: "var(--green-900)" }}>
        Share these credentials once
      </p>
      <dl className="mt-2 space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-xs" style={{ color: "var(--ink-mute)" }}>
            Sign in as
          </dt>
          <dd className="font-mono text-xs" style={{ color: "var(--ink)" }}>
            {email}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-xs" style={{ color: "var(--ink-mute)" }}>
            Temporary password
          </dt>
          <dd className="flex items-center gap-2">
            <span className="font-mono text-xs" style={{ color: "var(--ink)" }}>
              {password}
            </span>
            <button
              type="button"
              onClick={copy}
              className="rounded-md px-2 py-0.5 text-xs font-medium transition-colors hover:underline"
              style={{ color: "var(--green-900)" }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-xs" style={{ color: "var(--ink-mute)" }}>
        They will be asked to set a new password the first time they sign in.
        This password is not shown again.
      </p>
    </div>
  );
}
