"use client";

const modules = [
  {
    id: "inventory",
    eyebrow: "Inventory",
    title: "Track stock in real time",
    desc: "SKU-level visibility with per-warehouse reorder points. Know what's low before it becomes a problem.",
    visual: (
      <div className="space-y-3">
        <div className="flex h-20 items-end gap-1.5">
          {[88, 64, 95, 42, 28, 72, 85].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t transition-all duration-500 hover:opacity-80"
              style={{
                height: `${h}%`,
                background: h > 50 ? "var(--sage)" : "rgba(255,255,255,0.12)",
              }}
            />
          ))}
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/50">1,842 SKUs tracked</span>
          <span className="text-[var(--sage)]">79% in stock</span>
        </div>
      </div>
    ),
  },
  {
    id: "fulfillment",
    eyebrow: "Fulfillment",
    title: "Pick, pack, ship",
    desc: "Full state-machine workflow from order to delivery. Every step tracked, nothing falls through.",
    visual: (
      <div className="space-y-3">
        {[
          { label: "Picking", count: "12 orders", pct: 100 },
          { label: "Packing", count: "8 orders", pct: 67 },
          { label: "Shipped", count: "4 orders", pct: 33 },
        ].map((step) => (
          <div key={step.label}>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-white/70">{step.label}</span>
              <span className="text-white/50">{step.count}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[var(--sage)] transition-all duration-700"
                style={{ width: `${step.pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "procurement",
    eyebrow: "Procurement",
    title: "Smarter reordering",
    desc: "Draft purchase orders from low-stock alerts. Supplier lead times factored into every decision.",
    visual: (
      <div className="grid grid-cols-2 gap-2">
        {[
          { num: "6", label: "Low stock alerts", accent: true },
          { num: "3", label: "Pending approval" },
          { num: "PO-2048", label: "Latest draft" },
          { num: "2.4d", label: "Avg lead time" },
        ].map((tile) => (
          <div
            key={tile.label}
            className={`rounded-xl p-3 ${tile.accent ? "bg-[var(--rust)]/20" : "bg-white/[0.06]"}`}
          >
            <p className={`text-lg font-semibold ${tile.accent ? "text-[var(--rust)]" : "text-white"}`}>
              {tile.num}
            </p>
            <p className="text-[10px] text-white/50">{tile.label}</p>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "forecasting",
    eyebrow: "Forecasting",
    title: "Predict demand",
    desc: "14-day Prophet models per warehouse, benchmarked against XGBoost and naive baselines.",
    variant: "light" as const,
    visual: (
      <div>
        <div className="mb-2 flex items-baseline gap-2">
          <span className="text-3xl font-bold text-[var(--ink)]">+18%</span>
          <span className="text-sm text-[var(--ink-mute)]">next 14 days</span>
        </div>
        <svg className="w-full" height="60" viewBox="0 0 200 60" fill="none" preserveAspectRatio="none">
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--forest)" stopOpacity="0.2" />
              <stop offset="100%" stopColor="var(--forest)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0,45 Q25,42 50,38 T100,28 T150,18 T200,8 V60 H0 Z"
            fill="url(#chartGradient)"
          />
          <path
            d="M0,45 Q25,42 50,38 T100,28 T150,18 T200,8"
            fill="none"
            stroke="var(--forest)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="200" cy="8" r="4" fill="var(--forest)" />
        </svg>
        <p className="mt-2 text-xs text-[var(--ink-mute)]">Based on 90-day rolling history</p>
      </div>
    ),
  },
];

export default function LandingModules() {
  return (
    <section id="modules" className="bg-[var(--bg)] px-6 py-20 lg:px-10">
      <div className="mx-auto max-w-[var(--maxw)]">
        {/* Header */}
        <div className="mb-12 text-center">
          <p className="mb-3 font-mono text-xs tracking-wide text-[var(--ink-mute)]">/modules</p>
          <h2 className="mb-4 text-2xl font-semibold tracking-tight text-[var(--ink)] sm:text-3xl">
            Everything your warehouse team needs
          </h2>
          <p className="mx-auto max-w-lg text-[var(--ink-soft)]">
            Four tightly integrated modules. Real data flows between them — no copy-paste, no drift.
          </p>
        </div>

        {/* Cards Grid */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {modules.map((mod) => {
            const isDark = mod.variant !== "light";
            return (
              <article
                key={mod.id}
                className={`group flex flex-col rounded-2xl border p-5 transition-all duration-300 hover:shadow-xl ${
                  isDark
                    ? "border-white/10 bg-[var(--forest)] hover:border-white/20"
                    : "border-[var(--line)] bg-[var(--bg-alt)] hover:border-[var(--sage-deep)]"
                }`}
              >
                <p
                  className={`mb-4 text-[10px] font-semibold uppercase tracking-wider ${
                    isDark ? "text-[var(--sage)]" : "text-[var(--sage-deep)]"
                  }`}
                >
                  {mod.eyebrow}
                </p>

                <div className="mb-5 flex-1">{mod.visual}</div>

                <div>
                  <p className={`mb-1 font-semibold ${isDark ? "text-white" : "text-[var(--ink)]"}`}>
                    {mod.title}
                  </p>
                  <p className={`text-sm ${isDark ? "text-white/60" : "text-[var(--ink-mute)]"}`}>
                    {mod.desc}
                  </p>
                </div>
              </article>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <div className="mt-12 text-center">
          <a
            href="#how"
            className="inline-flex items-center gap-2 text-sm font-medium text-[var(--forest)] transition hover:text-[var(--sage-deep)]"
          >
            See how it all connects
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M8 3v10M4 9l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}
