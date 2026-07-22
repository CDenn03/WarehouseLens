"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: JSX.Element;
}

const iconClass = "h-5 w-5 shrink-0";

const navItems: NavItem[] = [
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
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ appName }: { appName: string }) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r bg-white" style={{ borderColor: "var(--border-soft)" }}>
      {/* Brand mark — matches the /WarehouseLens style from the landing page */}
      <div className="flex h-14 items-center gap-2 border-b px-5" style={{ borderColor: "var(--border-soft)" }}>
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
          style={{ background: "var(--green-900)" }}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5M3.75 21V9.349m16.5 11.651V9.349m-16.5 0L12 3l8.25 6.349M7.5 21v-6h3v6m3-6h3v6" />
          </svg>
        </span>
        <span className="text-base font-semibold tracking-tight" style={{ color: "var(--ink)" }}>
          {appName}
        </span>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "text-white"
                  : "hover:bg-brand-50",
              )}
              style={
                active
                  ? { background: "var(--green-900)", color: "#f4f3ee" }
                  : { color: "var(--ink-soft)" }
              }
              aria-current={active ? "page" : undefined}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t px-5 py-3" style={{ borderColor: "var(--border-soft)" }}>
        <p className="text-xs" style={{ color: "var(--ink-mute)" }}>
          Auth scaffold active — see <code>lib/auth.ts</code>
        </p>
      </div>
    </aside>
  );
}
