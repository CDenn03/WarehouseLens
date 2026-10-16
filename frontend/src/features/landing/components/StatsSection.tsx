const stats = [
  { value: "3", unit: "warehouses", desc: "managed from one workspace" },
  { value: "24", unit: "SKUs", desc: "tracked with per-site reorder points" },
  { value: "14-day", unit: "forecast", desc: "Prophet + XGBoost, benchmarked" },
  { value: "6", unit: "roles", desc: "scoped to site and capability" },
] as const;

export function StatsSection() {
  return (
    <div className="border-y border-[var(--line)] bg-[var(--bg-alt)]">
      <div className="mx-auto grid max-w-[var(--maxw)] grid-cols-2 divide-x divide-[var(--line)] lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.unit} className="px-6 py-8 text-center lg:py-10">
            <p className="text-3xl font-semibold text-[var(--ink)]">{s.value}</p>
            <p className="text-sm font-medium text-[var(--ink)]">{s.unit}</p>
            <p className="mt-1 text-xs text-[var(--ink-mute)]">{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
