"use client";

import { Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

function SignInForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const error = searchParams.get("error");

  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{ background: "var(--bg)" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8 text-center"
        style={{
          background: "var(--panel)",
          border: "1px solid var(--border-soft)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.06)",
        }}
      >
        <h1 className="mb-2 text-xl font-bold" style={{ color: "var(--ink)" }}>
          WarehouseLens
        </h1>
        <p className="mb-8 text-sm" style={{ color: "var(--ink-mute)" }}>
          Sign in to continue
        </p>
        {error && (
          <p className="mb-4 text-xs" style={{ color: "var(--error)" }}>
            {error === "Configuration"
              ? "Server misconfiguration. Please contact an administrator."
              : `Sign-in error: ${error}`}
          </p>
        )}
        <button
          onClick={() => signIn("keycloak", { callbackUrl })}
          className="inline-flex w-full items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold text-[#f4f3ee] transition-colors hover:opacity-90"
          style={{
            background: "var(--green-900)",
            boxShadow: "0 8px 18px rgba(34,54,30,0.24)",
          }}
        >
          Sign in with Keycloak
        </button>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div
          className="flex min-h-screen items-center justify-center"
          style={{ background: "var(--bg)" }}
        >
          <p style={{ color: "var(--ink-mute)" }}>Loading...</p>
        </div>
      }
    >
      <SignInForm />
    </Suspense>
  );
}
