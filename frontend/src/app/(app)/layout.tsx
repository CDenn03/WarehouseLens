import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { getSession } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "WarehouseLens";

export const metadata: Metadata = {
  title: {
    default: appName,
    template: `%s · ${appName}`,
  },
  description: "Warehouse operations with an AI copilot",
};

interface MeResponse {
  sub: string;
  username: string;
  email: string | null;
  tenant_id: string | null;
  roles: { slug: string; name: string }[];
}

async function getMe(token: string): Promise<MeResponse | null> {
  try {
    return await apiFetch<MeResponse>("/auth/me", { token });
  } catch {
    return null;
  }
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/signin");

  const me = await getMe(session.accessToken);
  const isPlatformAdmin =
    me?.roles.some((r) => r.slug === "platform_admin") ?? false;

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
