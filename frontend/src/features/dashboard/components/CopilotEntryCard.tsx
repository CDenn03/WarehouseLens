import Link from "next/link";

const SUGGESTIONS = [
  "Which SKUs are at risk of stockout in Nairobi this week?",
  "Summarise open outbound requests across all warehouses",
  "What products should I reorder for Mombasa?",
  "Show demand forecast for packaging tape",
];

export function CopilotEntryCard() {
  return (
    <div
      className="relative overflow-hidden rounded-xl p-5"
      style={{
        background: "var(--green-900)",
        border: "1px solid var(--green-800)",
      }}
    >
      {/* Subtle radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse at 80% 20%, rgba(255,255,255,0.06) 0%, transparent 60%)",
        }}
      />

      {/* Header */}
      <div className="relative mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-lg"
              style={{ background: "rgba(255,255,255,0.12)" }}
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
                style={{ color: "var(--ink-on-brand)" }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm3.75 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm3.75 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM21 12c0 4.556-4.03 8.25-9 8.25a9.76 9.76 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
                />
              </svg>
            </span>
            <h3 className="text-sm font-semibold" style={{ color: "var(--ink-on-brand)" }}>
              AI Copilot
            </h3>
          </div>
          <p className="mt-1 text-xs" style={{ color: "rgba(244,243,238,0.6)" }}>
            Ask anything about your warehouses
          </p>
        </div>

        {/* Live indicator */}
        <div className="flex items-center gap-1.5">
          <span
            className="h-1.5 w-1.5 animate-pulse rounded-full"
            style={{ background: "#A8C29C" }}
          />
          <span className="text-[11px]" style={{ color: "rgba(244,243,238,0.5)" }}>
            Ready
          </span>
        </div>
      </div>

      {/* Suggestion chips */}
      <div className="relative mb-4 flex flex-col gap-1.5">
        {SUGGESTIONS.map((s) => (
          <Link
            key={s}
            href={`/copilot?q=${encodeURIComponent(s)}`}
            className="group flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition-colors"
            style={{
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.10)",
              color: "rgba(244,243,238,0.8)",
            }}
          >
            <svg
              className="h-3 w-3 shrink-0 opacity-60"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
            <span className="truncate">{s}</span>
          </Link>
        ))}
      </div>

      {/* CTA */}
      <Link
        href="/copilot"
        className="relative flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
        style={{
          background: "rgba(255,255,255,0.12)",
          border: "1px solid rgba(255,255,255,0.18)",
          color: "var(--ink-on-brand)",
        }}
      >
        Open Copilot
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
        </svg>
      </Link>
    </div>
  );
}
