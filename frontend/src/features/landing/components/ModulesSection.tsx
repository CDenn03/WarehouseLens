const tiles = [
  {
    large: true,
    title: "Multi-warehouse inventory",
    desc: "Stock and reorder points tracked per site, never blended across locations.",
    art: (
      // viewBox is wide (800×520) to match the span-2/span-2 tile footprint.
      // Grid lines provide texture; three site rows sit centred in the lower half.
      <svg viewBox="0 0 800 520" aria-hidden="true" className="h-full w-full">
        <rect width="800" height="520" fill="#22361e" />

        {/* Background grid */}
        <g stroke="rgba(255,255,255,0.08)" strokeWidth="1.5">
          <line x1="0"   y1="130" x2="800" y2="130" />
          <line x1="0"   y1="260" x2="800" y2="260" />
          <line x1="0"   y1="390" x2="800" y2="390" />
          <line x1="160" y1="0"   x2="160" y2="520" />
          <line x1="320" y1="0"   x2="320" y2="520" />
          <line x1="480" y1="0"   x2="480" y2="520" />
          <line x1="640" y1="0"   x2="640" y2="520" />
        </g>

        {/* ── Site A ── */}
        {/* Pill label */}
        <rect x="60" y="152" width="140" height="44" rx="10" fill="rgba(233,239,230,0.10)" />
        <text x="84" y="180" fill="#e9efe6" fontFamily="Inter, sans-serif" fontWeight="700" fontSize="20">Site A</text>
        {/* Location pin dot */}
        <circle cx="68" cy="174" r="5" fill="#8a9880" />
        {/* Track background */}
        <rect x="220" y="163" width="460" height="22" rx="11" fill="rgba(255,255,255,0.07)" />
        {/* Filled bar — 78% */}
        <rect x="220" y="163" width="359" height="22" rx="11" fill="rgba(233,239,230,0.55)" />
        {/* Stock label */}
        <text x="692" y="180" fill="rgba(233,239,230,0.6)" fontFamily="Inter, sans-serif" fontWeight="500" fontSize="17">78%</text>

        {/* ── Site B ── */}
        <rect x="60" y="238" width="140" height="44" rx="10" fill="rgba(233,239,230,0.10)" />
        <text x="84" y="266" fill="#e9efe6" fontFamily="Inter, sans-serif" fontWeight="700" fontSize="20">Site B</text>
        <circle cx="68" cy="260" r="5" fill="#8a9880" />
        <rect x="220" y="249" width="460" height="22" rx="11" fill="rgba(255,255,255,0.07)" />
        {/* 45% */}
        <rect x="220" y="249" width="207" height="22" rx="11" fill="rgba(233,239,230,0.38)" />
        <text x="692" y="266" fill="rgba(233,239,230,0.6)" fontFamily="Inter, sans-serif" fontWeight="500" fontSize="17">45%</text>

        {/* ── Site C ── */}
        <rect x="60" y="324" width="140" height="44" rx="10" fill="rgba(233,239,230,0.10)" />
        <text x="84" y="352" fill="#e9efe6" fontFamily="Inter, sans-serif" fontWeight="700" fontSize="20">Site C</text>
        <circle cx="68" cy="346" r="5" fill="#8a9880" />
        <rect x="220" y="335" width="460" height="22" rx="11" fill="rgba(255,255,255,0.07)" />
        {/* 91% */}
        <rect x="220" y="335" width="419" height="22" rx="11" fill="rgba(233,239,230,0.70)" />
        <text x="692" y="352" fill="rgba(233,239,230,0.6)" fontFamily="Inter, sans-serif" fontWeight="500" fontSize="17">91%</text>

        {/* Reorder threshold tick — same x on every row so it reads as a rule */}
        <line x1="516" y1="148" x2="516" y2="368" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" strokeDasharray="4 4" />
        <text x="520" y="146" fill="rgba(255,255,255,0.35)" fontFamily="Inter, sans-serif" fontSize="14">reorder point</text>
      </svg>
    ),
  },
  {
    large: false,
    title: "Pick > pack > ship",
    desc: "Orders move through real state, stock reserved at the right step.",
    art: (
      <svg viewBox="0 0 400 260" aria-hidden="true" className="h-full w-full">
        <rect width="400" height="260" fill="#465741" />
        <g stroke="rgba(255,255,255,0.14)" strokeWidth="10" strokeLinecap="round">
          <line x1="40" y1="40" x2="360" y2="40" />
          <line x1="40" y1="90" x2="300" y2="90" />
          <line x1="40" y1="140" x2="330" y2="140" />
          <line x1="40" y1="190" x2="260" y2="190" />
        </g>
      </svg>
    ),
  },
  {
    large: false,
    title: "Demand forecasting",
    desc: "Per-warehouse Prophet model, checked against XGBoost and a naive baseline.",
    art: (
      <svg viewBox="0 0 400 260" aria-hidden="true" className="h-full w-full">
        <rect width="400" height="260" fill="#8a9880" />
        <polyline
          points="20,220 90,150 150,190 220,90 290,120 380,40"
          fill="none"
          stroke="#1c2818"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    large: false,
    title: "AI copilot",
    desc: "Tool-routed against the same API the UI calls — no free-form queries.",
    art: (
      <svg viewBox="0 0 400 260" aria-hidden="true" className="h-full w-full">
        <rect width="400" height="260" fill="#1c2818" />
        <rect x="60" y="60" width="280" height="140" rx="10" fill="#2f4a29" />
        <circle cx="110" cy="130" r="8" fill="#e9efe6" />
        <rect x="140" y="112" width="160" height="10" rx="5" fill="rgba(233,239,230,0.5)" />
        <rect x="140" y="136" width="120" height="10" rx="5" fill="rgba(233,239,230,0.3)" />
      </svg>
    ),
  },
] as const;

export function ModulesSection() {
  return (
    <section id="features" className="py-14 md:py-20">
      <div className="mx-auto w-full px-6" style={{ maxWidth: "var(--maxw)" }}>
        {/* Section head */}
        <div className="mb-10 flex flex-wrap items-end justify-between gap-8">
          <div>
            <p className="mb-3 text-xs font-semibold" style={{ color: "var(--green-900)" }}>
              /Modules
            </p>
            <h2
              className="max-w-[460px] text-2xl font-extrabold tracking-tight md:text-[2.1rem]"
              style={{ color: "var(--ink)" }}
            >
              Warehouse operations, unified
            </h2>
            <p className="mt-3 max-w-[380px] text-base" style={{ color: "var(--ink-soft)" }}>
              Five working parts, built to the same permission model, so nothing
              slips through the gap between systems.
            </p>
          </div>
          <a
            href="#stack"
            className="inline-flex items-center rounded-full px-5 py-2.5 text-sm font-semibold text-[#f4f3ee] transition-opacity hover:opacity-85"
            style={{ background: "var(--green-900)", boxShadow: "0 8px 18px rgba(34,54,30,0.24)" }}
          >
            See stack
          </a>
        </div>

        {/* Tile grid — 4-col, large tile spans 2×2, small tiles fill remaining cells */}
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: "repeat(4, 1fr)", gridTemplateRows: "auto" }}
        >
          {tiles.map((tile) => (
            <article
              key={tile.title}
              className="group relative flex flex-col overflow-hidden rounded-xl transition-all duration-150 hover:-translate-y-1"
              style={{
                border: "1px solid var(--border-soft)",
                boxShadow: "var(--shadow)",
                gridColumn: tile.large ? "span 2" : undefined,
                gridRow: tile.large ? "span 2" : undefined,
                /* Small tiles: fixed min-height so they don't collapse */
                minHeight: tile.large ? undefined : "200px",
              }}
            >
              {/* Art fills all available space above the caption */}
              <div className="min-h-0 flex-1">
                {tile.art}
              </div>
              {/* Caption overlay — pinned to bottom */}
              <div
                className="absolute inset-x-0 bottom-0 px-4 py-3.5"
                style={{ background: "linear-gradient(to top, rgba(10,14,8,0.82) 60%, rgba(10,14,8,0))" }}
              >
                <h3 className="mb-1 text-base font-bold text-[#f4f3ee]">{tile.title}</h3>
                <p className="max-w-[34ch] text-[0.84rem] text-[rgba(244,243,238,0.82)]">
                  {tile.desc}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
