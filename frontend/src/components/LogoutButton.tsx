"use client";

import { useState } from "react";

/**
 * LogoutButton — initiates RP-initiated logout.
 *
 * Navigates to /api/auth/logout, which:
 *   1. Clears the NextAuth session cookie server-side.
 *   2. Redirects to Keycloak's end-session endpoint (terminates SSO session).
 *   3. Keycloak redirects back to /signin.
 *
 * This is a plain anchor-navigation (not a fetch) so the browser follows
 * the redirect chain including the Keycloak end-session round-trip.
 */
export function LogoutButton() {
  const [loading, setLoading] = useState(false);

  function handleLogout() {
    setLoading(true);
    // Full navigation — must not be a fetch() call.  The redirect chain
    // (Next.js → Keycloak → /signin) requires the browser to follow it.
    window.location.href = "/api/auth/logout";
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--bg-alt)] disabled:opacity-50"
      style={{ color: "var(--ink-mute)" }}
      aria-label="Sign out"
    >
      {loading ? (
        <svg
          className="h-4 w-4 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          />
        </svg>
      ) : (
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
          />
        </svg>
      )}
      Sign out
    </button>
  );
}
