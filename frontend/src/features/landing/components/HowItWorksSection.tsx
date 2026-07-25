import "./landing.css";

const steps = [
  {
    number: "01",
    title: "Connect your warehouses",
    desc: "A platform admin provisions each site in minutes. Users are scoped to exactly the warehouses they need — nothing more.",
    art: (
      <svg viewBox="0 0 480 270" className="step-art" aria-hidden="true">
        <rect width="480" height="270" fill="var(--forest)" />
        {[80, 240, 400].map((x) => (
          <g key={x}>
            <rect x={x - 34} y={70} width={68} height={52} rx="8"
              fill="rgba(239,235,221,0.10)" />
            <rect x={x - 22} y={83} width={44} height={7} rx="3"
              fill="rgba(239,235,221,0.45)" />
            <rect x={x - 22} y={96} width={30} height={5} rx="2"
              fill="rgba(239,235,221,0.22)" />
            <line x1={x} y1={122} x2={240} y2={190}
              stroke="rgba(239,235,221,0.14)" strokeWidth="1.5" strokeDasharray="5 4" />
          </g>
        ))}
        <circle cx={240} cy={200} r={22} fill="rgba(239,235,221,0.10)" />
        <circle cx={240} cy={200} r={9} fill="#a8c29c" />
      </svg>
    ),
  },
  {
    number: "02",
    title: "Load your catalogue",
    desc: "Import products with SKUs, categories, and unit costs. Reorder points are set per warehouse so Site A's thresholds never bleed into Site B.",
    art: (
      <svg viewBox="0 0 480 270" className="step-art" aria-hidden="true">
        <rect width="480" height="270" fill="var(--forest-soft)" />
        {[60, 110, 160, 210].map((y, i) => (
          <g key={y}>
            <rect x={40} y={y} width={400} height={34} rx="7"
              fill={i === 1 ? "rgba(239,235,221,0.16)" : "rgba(239,235,221,0.07)"} />
            <rect x={56} y={y + 12} width={80} height={8} rx="3"
              fill={i === 1 ? "rgba(239,235,221,0.7)" : "rgba(239,235,221,0.3)"} />
            <rect x={180} y={y + 12} width={50} height={8} rx="3"
              fill="rgba(239,235,221,0.18)" />
            <rect x={300} y={y + 12} width={60} height={8} rx="3"
              fill="rgba(239,235,221,0.18)" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    number: "03",
    title: "Ask the copilot anything",
    desc: "Demand trends, reorder risks, supplier lead times — your team gets answers in plain language, with the same scope limits as the UI.",
    art: (
      <svg viewBox="0 0 480 270" className="step-art" aria-hidden="true">
        <rect width="480" height="270" fill="#0f1d0e" />
        <rect x={40} y={50} width={220} height={44} rx="10"
          fill="rgba(239,235,221,0.08)" />
        <rect x={56} y={65} width={150} height={10} rx="4"
          fill="rgba(239,235,221,0.35)" />
        <rect x={140} y={120} width={260} height={64} rx="10"
          fill="rgba(239,235,221,0.12)" />
        <rect x={156} y={136} width={200} height={10} rx="4"
          fill="rgba(239,235,221,0.55)" />
        <rect x={156} y={154} width={140} height={8} rx="4"
          fill="rgba(239,235,221,0.28)" />
        <rect x={40} y={210} width={3} height={20} rx="1" fill="#a8c29c" />
        <rect x={50} y={216} width={100} height={8} rx="3"
          fill="rgba(239,235,221,0.12)" />
      </svg>
    ),
  },
] as const;

export function HowItWorksSection() {
  return (
    <section id="how" className="section-wrap">
      <div className="section-inner">
        <div className="section-head">
          <div className="section-eyebrow">/how it works</div>
          <h2 className="section-title">Up and running the same day</h2>
          <p className="section-sub">
            No weeks-long data migration. A sandbox with seed data is ready
            before you finish your first coffee.
          </p>
        </div>

        <div className="steps-grid">
          {steps.map((step) => (
            <article key={step.number} className="step-card">
              {step.art}
              <div className="step-body">
                <div className="step-number">{step.number}</div>
                <div className="step-title">{step.title}</div>
                <p className="step-desc">{step.desc}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
