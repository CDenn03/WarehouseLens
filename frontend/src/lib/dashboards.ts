/**
 * Dashboard routing — which landing page a user gets.
 *
 * The backend decides *which* dashboard from the caller's `dashboard.*`
 * permissions (see app/core/permissions/dashboard.py) and returns the answer as
 * `me.dashboard`.  This module only maps that answer to a URL, so the routing
 * rule has one implementation and the client can never grant itself a dashboard
 * the API would refuse to serve.
 */

import { apiFetch } from "@/lib/api";

/** Mirrors the kinds in DASHBOARD_PRECEDENCE on the backend. */
export type DashboardKind = "platform" | "tenant" | "operations";

export const DASHBOARD_ROUTES: Record<DashboardKind, string> = {
  platform: "/platform",
  tenant: "/admin",
  operations: "/dashboard",
};

export interface MeResponse {
  sub: string;
  username: string;
  email: string | null;
  tenant_id: string | null;
  roles: { slug: string; name: string }[];
  permissions: string[];
  /** null when the user holds no dashboard.* permission at all. */
  dashboard: DashboardKind | null;
}

/**
 * Fetch the caller's identity.  Returns null on any failure so the shell can
 * still render — callers must treat null as "no permissions known", never as
 * "permission granted".
 */
export async function getMe(token: string): Promise<MeResponse | null> {
  try {
    return await apiFetch<MeResponse>("/auth/me", { token });
  } catch {
    return null;
  }
}

/** The URL a user should land on, or null if they have no dashboard. */
export function dashboardHref(me: MeResponse | null): string | null {
  return me?.dashboard ? DASHBOARD_ROUTES[me.dashboard] : null;
}
