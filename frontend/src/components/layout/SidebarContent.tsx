"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LogoutButton } from "@/components/LogoutButton";
import { WarehouseLensLogo } from "@/components/WarehouseLensLogo";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** If set, the item is hidden unless the user holds this permission. */
  requiredPermission?: string;
}

const iconClass = "h-5 w-5 shrink-0";

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded px-3 py-2 text-sm font-medium transition-colors",
        active ? "text-ink-on-brand" : "hover:bg-brand-50",
      )}
      style={
        active
          ? { background: "var(--green-900)", color: "var(--ink-on-brand)" }
          : { color: "var(--ink-soft)" }
      }
      aria-current={active ? "page" : undefined}
    >
      {item.icon}
      {item.label}
    </Link>
  );
}

export interface SidebarContentProps {
  appName: string;
  brandSubtitle?: string;
  items: NavItem[];
  userName?: string;
}

export function SidebarContent({
  appName,
  brandSubtitle,
  items,
  userName,
}: SidebarContentProps) {
  const pathname = usePathname();

  return (
    <aside
      className="flex h-full w-60 flex-col border-r bg-surface-panel"
      style={{ borderColor: "var(--border-soft)" }}
    >
      {/* Brand mark */}
      <div
        className="flex h-14 items-center gap-2 border-b px-5"
        style={{ borderColor: "var(--border-soft)" }}
      >
        <WarehouseLensLogo variant="mark" size={32} />
        <div className="min-w-0">
          <span
            className="block truncate text-base font-semibold tracking-tight"
            style={{ color: "var(--ink)" }}
          >
            {appName}
          </span>
          {brandSubtitle && (
            <span
              className="block text-[10px] font-medium uppercase tracking-wider"
              style={{ color: "var(--ink-mute)" }}
            >
              {brandSubtitle}
            </span>
          )}
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {items.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={
              pathname === item.href ||
              (pathname.startsWith(`${item.href}/`) &&
                !items.some(
                  (other) =>
                    other.href !== item.href &&
                    (pathname === other.href ||
                      pathname.startsWith(`${other.href}/`)) &&
                    other.href.startsWith(item.href),
                ))
            }
          />
        ))}
      </nav>

      {/* Bottom: user identity + sign out */}
      <div
        className="border-t px-3 py-3"
        style={{ borderColor: "var(--border-soft)" }}
      >
        {userName && (
          <p
            className="mb-2 truncate px-2 text-xs font-medium"
            style={{ color: "var(--ink-soft)" }}
          >
            {userName}
          </p>
        )}
        <LogoutButton />
      </div>
    </aside>
  );
}

export { iconClass };
