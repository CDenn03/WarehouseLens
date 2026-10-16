import FeatureCard from "./FeatureCard";

export default function LandingModules() {
  return (
    <section id="modules" className="px-6 py-20 lg:px-10">
      <div className="mx-auto max-w-[var(--maxw)]">
        {/* Header */}
        <div className="mb-12 text-center">
          <p className="mb-3 font-mono text-xs tracking-wide text-[var(--ink-mute)]">
            /see it in action
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--ink)] sm:text-3xl">
            Built for every corner of your warehouse
          </h2>
        </div>

        {/* Cards Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Inventory */}
          <FeatureCard eyebrow="Inventory" title="Cargo container" subtitle="WHL 0248113 · Nairobi">
            <div className="flex h-24 items-end gap-1.5">
              {[88, 64, 95, 30, 18, 72, 12].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t"
                  style={{
                    height: `${h}%`,
                    background: h > 50 ? "var(--sage)" : "rgba(239,235,221,0.16)",
                  }}
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-white/50">1,842 units · 79% capacity</p>
          </FeatureCard>

          {/* Fulfillment */}
          <FeatureCard eyebrow="Fulfillment" title="Pick station" subtitle="Order #SO-4892 · Packing">
            <div className="space-y-2.5">
              {[
                { label: "Packing tape 48mm", pct: 100, text: "12/12" },
                { label: "Pallet wrap L", pct: 75, text: "9/12" },
                { label: "Corner guards", pct: 33, text: "4/12" },
              ].map((item) => (
                <div key={item.label}>
                  <div className="mb-1 flex justify-between text-xs text-white/70">
                    <span>{item.label}</span>
                    <span>{item.text}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-[var(--sage)]"
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </FeatureCard>

          {/* Procurement */}
          <FeatureCard eyebrow="Procurement" title="Procurement" subtitle="PO-2048 · Draft reorder">
            <div className="grid grid-cols-2 gap-2">
              {[
                { num: "6", label: "low stock alerts" },
                { num: "3", label: "pending approval" },
                { num: "PO", label: "2048 · draft", accent: true },
                { num: "2d", label: "avg. lead time" },
              ].map((tile) => (
                <div
                  key={tile.label}
                  className={`rounded-lg p-3 ${
                    tile.accent ? "bg-[var(--rust)]/20" : "bg-white/[0.06]"
                  }`}
                >
                  <p className="text-lg font-semibold text-white">{tile.num}</p>
                  <p className="text-[10px] text-white/50">{tile.label}</p>
                </div>
              ))}
            </div>
          </FeatureCard>

          {/* Forecasting */}
          <FeatureCard variant="light" eyebrow="Forecasting" title="Forecasting" subtitle="14-day Prophet model">
            <div>
              <p className="text-3xl font-semibold text-[var(--ink)]">+18%</p>
              <p className="mb-3 text-xs text-[var(--ink-mute)]">projected demand, next 14 days</p>
              <svg className="w-full" height="70" viewBox="0 0 220 70" fill="none">
                <polyline
                  points="0,50 30,42 55,48 80,30 105,36 130,22 160,26 190,10 220,6"
                  fill="none"
                  stroke="var(--ink)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="220" cy="6" r="4" fill="var(--ink)" />
              </svg>
            </div>
          </FeatureCard>
        </div>
      </div>
    </section>
  );
}
