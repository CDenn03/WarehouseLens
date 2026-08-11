const warehouses = [
  { name: "Nairobi", status: "Healthy", isWarning: false },
  { name: "Mombasa", status: "Low stock — 2 items below reorder", isWarning: true },
  { name: "Kisumu", status: "Healthy", isWarning: false },
];

const reorderRisks = [
  { item: "Packaging Tape", days: 6, severity: "critical" as const },
  { item: "Pallet Wrap", days: 12, severity: "warning" as const },
  { item: "Steel Straps", days: 18, severity: "ok" as const },
];

const severityStyles = {
  critical: { color: "text-red-400", bg: "bg-red-400", label: "Reorder now" },
  warning: { color: "text-amber-400", bg: "bg-amber-400", label: "Order soon" },
  ok: { color: "text-emerald-400", bg: "bg-emerald-400", label: "Sufficient" },
};

export default function LandingHero() {
  return (
    <header className="relative overflow-hidden bg-[var(--bg)]">
      <div className="mx-auto max-w-[var(--maxw)] px-6 py-16 lg:px-10 lg:py-20">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>

            <h1 className="mb-6 text-4xl font-semibold leading-[1.1] tracking-tight text-[var(--ink)] sm:text-5xl lg:text-[3.25rem]">
              Know what&apos;s happening across every warehouse.
            </h1>

            <p className="mb-8 max-w-md text-base leading-relaxed text-[var(--ink-soft)]">
              Monitor inventory, procurement, fulfillment, and warehouse performance from a single
              workspace. Real-time visibility into stock levels, operational risks, and purchasing
              decisions across every site.
            </p>

            <div className="flex flex-wrap gap-3">
              <button className="rounded-lg bg-[var(--forest)] px-5 py-2.5 text-sm font-medium text-[var(--ink-on-brand)] shadow-md transition hover:opacity-90">
                Request Demo
              </button>
              <a
                href="#modules"
                className="rounded-lg border border-[var(--line)] px-5 py-2.5 text-sm font-medium text-[var(--ink)] transition hover:border-[var(--forest)] hover:text-[var(--forest)]"
              >
                See how it works
              </a>
            </div>
          </div>

          {/* Right: Dashboard Preview */}
          <div className="relative">
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--forest)] p-6 shadow-xl">
              {/* Panel Header */}
              <div className="mb-5 flex items-center justify-between">
                <span className="text-sm font-medium text-[var(--ink-on-brand)]">Warehouse Overview</span>
                <span className="flex items-center gap-1.5 text-xs text-[var(--sage)]">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                  Live
                </span>
              </div>

              {/* Warehouse Status */}
              <div className="mb-5">
                <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-white/50">
                  Warehouse Status
                </p>
                <div className="space-y-1.5">
                  {warehouses.map((w) => (
                    <div
                      key={w.name}
                      className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                        w.isWarning ? "bg-amber-500/10" : "bg-emerald-500/10"
                      }`}
                    >
                      <span className="font-medium text-[var(--ink-on-brand)]">{w.name}</span>
                      <span className={w.isWarning ? "text-amber-400" : "text-emerald-400"}>
                        {w.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reorder Risks */}
              <div className="mb-5">
                <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-white/50">
                  Reorder Risks
                </p>
                <div className="space-y-3">
                  {reorderRisks.map((r) => {
                    const style = severityStyles[r.severity];
                    const pct = Math.min(100, (1 - r.days / 30) * 100);
                    return (
                      <div key={r.item}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="text-[var(--ink-on-brand)]">{r.item}</span>
                          <span className={style.color}>
                            {r.days} days — {style.label}
                          </span>
                        </div>
                        <div className="h-1 overflow-hidden rounded-full bg-white/10">
                          <div className={`h-full ${style.bg}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="mt-3 flex gap-4 text-[10px] text-white/40">
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-3 rounded-sm bg-red-400" />
                    {"< 7d"}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-3 rounded-sm bg-amber-400" />
                    7–14d
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-3 rounded-sm bg-emerald-400" />
                    {"> 14d"}
                  </span>
                </div>
              </div>

              {/* Footer Stats */}
              <div className="flex items-end justify-between border-t border-white/10 pt-4">
                <div>
                  <p className="text-[10px] text-white/40">Inventory Health</p>
                  <p className="text-2xl font-semibold text-[var(--ink-on-brand)]">96%</p>
                </div>
                <p className="text-xs text-white/40">Across 3 warehouses</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
