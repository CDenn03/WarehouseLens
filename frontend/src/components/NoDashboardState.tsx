import { PageHeader } from "@/components/PageHeader";

/**
 * Shown when a user holds no `dashboard.*` permission.
 *
 * Deny-by-default means this is a legitimate state, not an error: the account
 * authenticated fine, it simply has no landing page assigned yet.  Saying so
 * plainly beats redirecting them into a dashboard that 403s on every request.
 */
export function NoDashboardState() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="No dashboard assigned"
        description="Your account is active but has not been granted a dashboard yet."
      />
      <div
        className="rounded-xl p-6 text-sm"
        style={{
          background: "var(--panel)",
          border: "1px solid var(--border-soft)",
          color: "var(--ink-mute)",
        }}
      >
        Ask an administrator to assign you a role. Roles carry the permission
        that determines which dashboard you land on.
      </div>
    </div>
  );
}
