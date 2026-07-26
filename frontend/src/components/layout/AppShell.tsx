"use client";

import { useState } from "react";
import {
  SidebarContent,
  iconClass,
  type NavItem,
} from "@/components/layout/SidebarContent";
import { MobileDrawer } from "@/components/MobileDrawer";
import type { DashboardKind } from "@/lib/dashboards";

const tenantNavItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5h6v6.75h-6zM3.75 3.75h6V10.5h-6zM13.5 3.75h6.75v6h-6.75zM13.5 12.75h6.75v7.5H13.5z" />
      </svg>
    ),
  },
  {
    href: "/inventory",
    label: "Inventory",
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-8.25-4.5L3.75 7.5m16.5 0v9l-8.25 4.5m8.25-13.5L12 12m-8.25-4.5v9L12 21m0-9v9" />
      </svg>
    ),
  },
  {
    href: "/warehouses",
    label: "Warehouses",
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5M3.75 21V9.349m16.5 11.651V9.349M12 3L3.75 9.349m16.5 0L12 3m0 0v18M7.5 12h3m3 0h3" />
      </svg>
    ),
  },
  {
    href: "/procurement",
    label: "Procurement",
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.5l2.4 12.24a1.5 1.5 0 001.47 1.21h10.13a1.5 1.5 0 001.46-1.15L21.75 6H5.1M9 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm9 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
      </svg>
    ),
  },
  {
    href: "/outbound",
    label: "Outbound",
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0m3 0h6m-9 0H3.375A1.125 1.125 0 012.25 17.625V6.375c0-.621.504-1.125 1.125-1.125h9.75c.621 0 1.125.504 1.125 1.125v11.25m4.5 1.125a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0m3 0h1.125c.621 0 1.125-.504 1.125-1.125v-4.072c0-.256-.088-.505-.248-.704l-2.472-3.09a1.125 1.125 0 00-.879-.421H14.25" />
      </svg>
    ),
  },
  {
    href: "/copilot",
    label: "Copilot",
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm3.75 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm3.75 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM21 12c0 4.556-4.03 8.25-9 8.25a9.76 9.76 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
      </svg>
    ),
  },
  {
    href: "/admin/users",
    label: "Admin",
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
  },
  {
    href: "/admin/roles",
    label: "Roles",
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  {
    href: "/admin/permissions",
    label: "Permissions",
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
      </svg>
    ),
  },
];

const platformNavItems: NavItem[] = [
  {
    href: "/platform",
    label: "Dashboard",
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5h6v6.75h-6zM3.75 3.75h6V10.5h-6zM13.5 3.75h6.75v6h-6.75zM13.5 12.75h6.75v7.5H13.5z" />
      </svg>
    ),
  },
  {
    href: "/platform/tenants",
    label: "Tenants",
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5M3.75 21V9.349m16.5 11.651V9.349M12 3L3.75 9.349m16.5 0L12 3m0 0v18M7.5 12h3m3 0h3" />
      </svg>
    ),
  },
  {
    href: "/platform/admins",
    label: "Platform Admins",
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
  },
];

// Tenant administrators manage people and sites, not stock — so their nav is
// the /admin section plus warehouses, not the operational modules they hold no
// permission for.
const tenantAdminNavItems: NavItem[] = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5h6v6.75h-6zM3.75 3.75h6V10.5h-6zM13.5 3.75h6.75v6h-6.75zM13.5 12.75h6.75v7.5H13.5z" />
      </svg>
    ),
  },
  {
    href: "/admin/users",
    label: "Users",
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
  },
  {
    href: "/admin/roles",
    label: "Roles",
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  {
    href: "/admin/permissions",
    label: "Permissions",
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
      </svg>
    ),
  },
  {
    href: "/warehouses",
    label: "Warehouses",
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5M3.75 21V9.349m16.5 11.651V9.349M12 3L3.75 9.349m16.5 0L12 3m0 0v18M7.5 12h3m3 0h3" />
      </svg>
    ),
  },
];

/** Sidebar variant per dashboard kind — same key the backend routes on. */
const NAV_BY_DASHBOARD: Record<DashboardKind, { items: NavItem[]; subtitle?: string }> = {
  platform: { items: platformNavItems, subtitle: "Platform" },
  tenant: { items: tenantAdminNavItems, subtitle: "Administration" },
  operations: { items: tenantNavItems },
};

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export interface AppShellProps {
  appName: string;
  /** Which dashboard the caller was routed to; null when they hold none. */
  dashboard: DashboardKind | null;
  userName?: string;
  userEmail?: string;
  headerContext: string;
  children: React.ReactNode;
}

export function AppShell({
  appName,
  dashboard,
  userName,
  userEmail,
  headerContext,
  children,
}: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  // A user with no dashboard permission gets no navigation — every link would
  // lead somewhere they cannot read.
  const { items, subtitle: brandSubtitle } = dashboard
    ? NAV_BY_DASHBOARD[dashboard]
    : { items: [], subtitle: undefined };

  return (
    <div className="app-shell flex min-h-screen">
      {/* Desktop sidebar */}
      <div className="sticky top-0 hidden h-screen md:block">
        <SidebarContent
          appName={appName}
          brandSubtitle={brandSubtitle}
          items={items}
          userName={userName}
        />
      </div>

      {/* Mobile drawer */}
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <SidebarContent
          appName={appName}
          brandSubtitle={brandSubtitle}
          items={items}
          userName={userName}
        />
      </MobileDrawer>

      {/* Content area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-[var(--panel)] px-4 md:px-6"
          style={{ borderColor: "var(--border-soft)" }}
        >
          {/* Mobile hamburger */}
          <button
            type="button"
            className="flex items-center justify-center rounded-lg p-1.5 transition-colors hover:bg-brand-50 md:hidden"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation menu"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            </svg>
          </button>

          <p
            className="hidden text-sm md:block"
            style={{ color: "var(--ink-mute)" }}
          >
            {headerContext}
          </p>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p
                className="text-sm font-medium"
                style={{ color: "var(--ink)" }}
              >
                {userName}
              </p>
            </div>
            {userName && (
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-ink-on-brand"
                style={{ background: "var(--green-900)" }}
                aria-label={`Signed in as ${userName}`}
              >
                {initialsOf(userName)}
              </div>
            )}
          </div>
        </header>
        <main className="flex-1 px-4 py-6 md:px-6">{children}</main>
      </div>
    </div>
  );
}
