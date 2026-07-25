import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { getSession } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import type { IamUserRead } from "@/features/admin/types";

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "WarehouseLens";

export const metadata: Metadata = {
  title: {
    default: appName,
    template: `%s · ${appName}`,
  },
  description: "Warehouse operations with an AI copilot",
};

async function getIsPlatformAdmin(sub: string): Promise<boolean> {
  try {
    const user = await apiFetch<IamUserRead>(`/iam/users/${sub}`);
    return user.roles.some((r) => r.slug === "platform_admin");
  } catch {
    return false;
  }
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/signin");

  const isPlatformAdmin = await getIsPlatformAdmin(session.user.sub);

  return (
    <AppShell
      appName={appName}
      isPlatformAdmin={isPlatformAdmin}
      userName={session.user.name}
      headerContext={
        isPlatformAdmin
          ? "Platform administration"
          : "Warehouse operations console"
      }
    >
      {children}
    </AppShell>
  );
}
