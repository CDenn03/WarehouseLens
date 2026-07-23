import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Sidebar } from "@/components/Sidebar";
import { getSession } from "@/lib/auth";

import { redirect } from "next/navigation";

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "WarehouseLens";

export const metadata: Metadata = {
  title: {
    default: appName,
    template: `%s · ${appName}`,
  },
  description: "Warehouse operations with an AI copilot",
};

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/api/auth/signin");

  return (
    <div className="flex min-h-screen">
      <Sidebar appName={appName} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="sticky top-0 z-10 flex h-14 items-center justify-between px-6 bg-[var(--panel)]"
          style={{ borderBottom: "1px solid var(--border-soft)" }}
        >
          <p className="text-sm" style={{ color: "var(--ink-mute)" }}>
            Warehouse operations console
          </p>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
                {session.user.name}
              </p>
            </div>
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-ink-on-brand"
              style={{ background: "var(--green-900)" }}
              aria-hidden="true"
            >
              {initialsOf(session.user.name)}
            </div>
          </div>
        </header>
        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
