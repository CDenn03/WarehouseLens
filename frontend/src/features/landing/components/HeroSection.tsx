export function HeroSection() {
  return (
    <>
      {/* Hero card — title + copy */}
      <section className="px-6 py-10 md:py-16">
        <div className="mx-auto w-full" style={{ maxWidth: "var(--maxw)" }}>
          <div
            className="overflow-hidden rounded-[28px] bg-[var(--panel)] p-6 md:p-10"
            style={{ border: "1px solid var(--border-soft)", boxShadow: "var(--shadow)" }}
          >
            <div className="flex flex-wrap items-start justify-between gap-10">
              <h1
                className="max-w-[560px] text-4xl font-extrabold leading-[1.06] tracking-[-0.03em] md:text-5xl lg:text-[3.3rem]"
                style={{ color: "var(--ink)" }}
              >
                Let&apos;s move your
                <br />
                warehouse forward
              </h1>
              <div className="flex max-w-[300px] flex-col items-start gap-4.5">
                <p className="text-[0.98rem]" style={{ color: "var(--ink-soft)" }}>
                  Multi-warehouse inventory, procurement, and the pick&nbsp;→&nbsp;pack&nbsp;→&nbsp;ship
                  workflow, forecasted per site and explained in plain language by an
                  AI copilot that can&apos;t wander off-script.
                </p>
                <a
                  href="#features"
                  className="inline-flex items-center rounded-full px-5 py-3 text-sm font-semibold text-[#f4f3ee] transition-transform active:translate-y-px"
                  style={{ background: "var(--green-900)", boxShadow: "0 8px 18px rgba(34,54,30,0.24)" }}
                >
                  Learn more
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Product preview — see it in action */}
      <section className="px-6 pb-12 md:pb-20">
        <div className="mx-auto w-full" style={{ maxWidth: "var(--maxw)" }}>
          {/* Section intro */}
          <div className="mb-8 text-center">
            <p className="mb-2 text-xs font-semibold" style={{ color: "var(--green-900)" }}>
              /See it in action
            </p>
            <h2
              className="text-xl font-extrabold tracking-tight md:text-2xl"
              style={{ color: "var(--ink)" }}
            >
              Built for every corner of your warehouse
            </h2>
          </div>

          {/* Card grid — 4 examples */}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {/* Card 1: Cargo container */}
            <div
              className="group overflow-hidden rounded-2xl transition-transform hover:-translate-y-1"
              style={{ background: "var(--green-900)", boxShadow: "var(--shadow)" }}
            >
              <div className="relative aspect-[4/3]">
                <svg viewBox="0 0 400 300" className="h-full w-full">
                  <rect width="400" height="300" fill="#22361e" />
                  <g stroke="rgba(255,255,255,0.16)" strokeWidth="2">
                    <line x1="26" y1="20" x2="26" y2="280" />
                    <line x1="60" y1="20" x2="60" y2="280" />
                    <line x1="94" y1="20" x2="94" y2="280" />
                    <line x1="128" y1="20" x2="128" y2="280" />
                    <line x1="162" y1="20" x2="162" y2="280" />
                    <line x1="196" y1="20" x2="196" y2="280" />
                    <line x1="230" y1="20" x2="230" y2="280" />
                    <line x1="264" y1="20" x2="264" y2="280" />
                    <line x1="298" y1="20" x2="298" y2="280" />
                    <line x1="332" y1="20" x2="332" y2="280" />
                  </g>
                  <text
                    x="20"
                    y="150"
                    fill="#e9efe6"
                    fontFamily="Inter, sans-serif"
                    fontWeight="800"
                    fontSize="28"
                    letterSpacing="0.5"
                  >
                    /WHL
                  </text>
                </svg>
              </div>
              <div className="p-5">
                <h3 className="mb-1 text-base font-bold text-[#e9efe6]">
                  Cargo container
                </h3>
                <p className="text-sm text-[rgba(233,239,230,0.7)]">
                  WHL 0248113 · Nairobi
                </p>
              </div>
            </div>

            {/* Card 2: Pick/Pack station */}
            <div
              className="group overflow-hidden rounded-2xl transition-transform hover:-translate-y-1"
              style={{ background: "var(--green-700)", boxShadow: "var(--shadow)" }}
            >
              <div className="relative aspect-[4/3]">
                <svg viewBox="0 0 400 300" className="h-full w-full">
                  <rect width="400" height="300" fill="#33472e" />
                  <g stroke="rgba(255,255,255,0.14)" strokeWidth="8" strokeLinecap="round">
                    <line x1="40" y1="60" x2="340" y2="60" />
                    <line x1="40" y1="120" x2="280" y2="120" />
                    <line x1="40" y1="180" x2="310" y2="180" />
                    <line x1="40" y1="240" x2="240" y2="240" />
                  </g>
                  <circle cx="360" cy="60" r="8" fill="rgba(233,239,230,0.5)" />
                  <circle cx="320" cy="120" r="8" fill="rgba(233,239,230,0.5)" />
                  <circle cx="350" cy="180" r="8" fill="rgba(233,239,230,0.5)" />
                </svg>
              </div>
              <div className="p-5">
                <h3 className="mb-1 text-base font-bold text-[#e9efe6]">
                  Pick station
                </h3>
                <p className="text-sm text-[rgba(233,239,230,0.7)]">
                  Order #SO-4892 · Packing
                </p>
              </div>
            </div>

            {/* Card 3: Procurement */}
            <div
              className="group overflow-hidden rounded-2xl transition-transform hover:-translate-y-1"
              style={{ background: "var(--green-600)", boxShadow: "var(--shadow)" }}
            >
              <div className="relative aspect-[4/3]">
                <svg viewBox="0 0 400 300" className="h-full w-full">
                  <rect width="400" height="300" fill="#465741" />
                  <rect x="60" y="60" width="120" height="80" rx="8" fill="rgba(233,239,230,0.15)" />
                  <rect x="220" y="60" width="120" height="80" rx="8" fill="rgba(233,239,230,0.15)" />
                  <rect x="60" y="160" width="120" height="80" rx="8" fill="rgba(233,239,230,0.15)" />
                  <rect x="220" y="160" width="120" height="80" rx="8" fill="rgba(233,239,230,0.25)" />
                  <text
                    x="240"
                    y="210"
                    fill="#e9efe6"
                    fontFamily="Inter, sans-serif"
                    fontWeight="700"
                    fontSize="32"
                  >
                    PO
                  </text>
                </svg>
              </div>
              <div className="p-5">
                <h3 className="mb-1 text-base font-bold text-[#e9efe6]">
                  Procurement
                </h3>
                <p className="text-sm text-[rgba(233,239,230,0.7)]">
                  PO-2048 · Draft reorder
                </p>
              </div>
            </div>

            {/* Card 4: Forecasting */}
            <div
              className="group overflow-hidden rounded-2xl transition-transform hover:-translate-y-1"
              style={{ background: "var(--green-300)", boxShadow: "var(--shadow)" }}
            >
              <div className="relative aspect-[4/3]">
                <svg viewBox="0 0 400 300" className="h-full w-full">
                  <rect width="400" height="300" fill="#8a9880" />
                  <polyline
                    points="40,240 100,180 160,200 220,120 280,150 360,70"
                    fill="none"
                    stroke="#1c2818"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="220" cy="120" r="6" fill="#1c2818" />
                  <circle cx="280" cy="150" r="6" fill="#1c2818" />
                  <circle cx="360" cy="70" r="6" fill="#1c2818" />
                </svg>
              </div>
              <div className="p-5">
                <h3 className="mb-1 text-base font-bold" style={{ color: "var(--ink)" }}>
                  Forecasting
                </h3>
                <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
                  14-day Prophet model
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
