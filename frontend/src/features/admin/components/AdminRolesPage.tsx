import { Card } from "@/components/Card";
import { ErrorState } from "@/components/ErrorState";
import { PageHeader } from "@/components/PageHeader";
import { getErrorMessage } from "@/lib/utils";
import { listRoles, listUsers } from "@/features/admin/services/adminService";

export async function AdminRolesPage() {
  let roles;
  let users;
  try {
    [roles, users] = await Promise.all([listRoles(), listUsers()]);
  } catch (error) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Roles"
          description="Manage user roles and permissions"
        />
        <ErrorState message={getErrorMessage(error)} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles"
        description="System roles and their assigned users"
      />

      <div className="space-y-4">
        {roles.map((role) => {
          const assignedUsers = users.filter((u) =>
            u.roles.some((r) => r.slug === role.slug),
          );

          return (
            <Card key={role.id}>
              <div className="mb-3 flex items-center justify-between">
                <h3
                  className="text-base font-semibold"
                  style={{ color: "var(--ink)" }}
                >
                  {role.name}
                </h3>
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{
                    background: "var(--green-050)",
                    color: "var(--green-900)",
                  }}
                >
                  {assignedUsers.length} user{assignedUsers.length !== 1 ? "s" : ""}
                </span>
              </div>

              {assignedUsers.length === 0 ? (
                <p
                  className="text-sm italic"
                  style={{ color: "var(--ink-mute)" }}
                >
                  No users assigned to this role
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {assignedUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center gap-2 rounded-lg px-3 py-2"
                      style={{
                        background: "var(--bg-alt)",
                        border: "1px solid var(--border-soft)",
                      }}
                    >
                      <div
                        className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-ink-on-brand"
                        style={{ background: "var(--green-900)" }}
                      >
                        {(user.username ?? user.email)
                          .split(/\s+/)
                          .slice(0, 2)
                          .map((p) => p[0])
                          .join("")
                          .toUpperCase()}
                      </div>
                      <span
                        className="text-sm font-medium"
                        style={{ color: "var(--ink)" }}
                      >
                        {user.username || user.email}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
