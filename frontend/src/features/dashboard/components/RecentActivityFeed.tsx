import Link from "next/link";
import { Badge } from "@/components/Badge";
import { formatDateTime } from "@/lib/utils";
import type { RecentActivity } from "@/features/dashboard/types";

interface Props {
  activities: RecentActivity[];
}

const iconClass = "h-4 w-4 shrink-0";

function ActivityIcon({ type }: { type: RecentActivity["type"] }) {
  if (type === "transfer") {
    return (
      <svg
        className={iconClass}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
        />
      </svg>
    );
  }
  return (
    <svg
      className={iconClass}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.25 18.75a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0m3 0h6m-9 0H3.375A1.125 1.125 0 012.25 17.625V6.375c0-.621.504-1.125 1.125-1.125h9.75c.621 0 1.125.504 1.125 1.125v11.25m4.5 1.125a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0m3 0h1.125c.621 0 1.125-.504 1.125-1.125v-4.072c0-.256-.088-.505-.248-.704l-2.472-3.09a1.125 1.125 0 00-.879-.421H14.25"
      />
    </svg>
  );
}

export function RecentActivityFeed({ activities }: Props) {
  if (activities.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm" style={{ color: "var(--ink-mute)" }}>
          No recent activity
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y" style={{ borderColor: "var(--border-soft)" }}>
      {activities.map((act) => (
        <li key={act.id}>
          <Link
            href={act.href}
            className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-[var(--bg-alt)]"
          >
            {/* Icon + badge aligned vertically with the title */}
            <div className="flex items-center gap-2 pt-0.5">
              <span style={{ color: "var(--ink-mute)" }}>
                <ActivityIcon type={act.type} />
              </span>
            </div>

            {/* Content */}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-start justify-between gap-2">
                <p
                  className="truncate text-sm font-medium hover:underline"
                  style={{ color: "var(--ink)" }}
                >
                  {act.title}
                </p>
                <Badge tone={act.statusTone}>{act.status}</Badge>
              </div>
              <p
                className="truncate text-xs"
                style={{ color: "var(--ink-mute)" }}
              >
                {act.subtitle}
              </p>
              {act.occurredAt && (
                <p
                  className="text-[11px]"
                  style={{ color: "var(--ink-mute)" }}
                >
                  {formatDateTime(act.occurredAt)}
                </p>
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
