import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { getSession } from "@/lib/auth";
import { getMe } from "@/lib/dashboards";

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "WarehouseLens";

export const metadata: Metadata = {
  title: {
    default: appName,
    template: `%s · ${appName}`,
  },
  description: "Warehouse operations with an AI copilot",
};

const HEADER_CONTEXT: Record<string, string> = {
  platform: "Platform administration",
  tenant: "Tenant administration",
  operations: "Warehouse operations console",
};

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/signin");

  const me = await getMe(session.accessToken);

  return (
    <AppShell
      appName={appName}
      dashboard={me?.dashboard ?? null}
      permissions={me?.permissions ?? []}
      userName={session.user.name}
      headerContext={
        me?.dashboard ? HEADER_CONTEXT[me.dashboard] : "No dashboard assigned"
      }
    >
      {children}
    </AppShell>
  );
}
