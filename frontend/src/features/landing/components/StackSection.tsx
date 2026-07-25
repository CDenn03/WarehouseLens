import "./landing.css";

const items = [
  {
    title: "Real-time inventory",
    desc: "Stock levels update the moment a movement posts, per warehouse.",
    href: "#modules",
  },
  {
    title: "Forecast benchmarking",
    desc: "Prophet is only shipped once it beats XGBoost and a naive baseline.",
    href: "#faq",
  },
  {
    title: "Automated reorder drafts",
    desc: "The copilot can draft a PO from a low-stock answer, one click away.",
    href: "#modules",
  },
  {
    title: "Scoped access",
    desc: "The same warehouse scope is enforced in the UI, API, and copilot.",
    href: "#who",
  },
] as const;

export function StackSection() {
  return (
    <section id="stack" className="section-wrap">
      <div className="section-inner">
        <div className="stack-inner">
          {/* Illustration */}
          <div className="stack-illustration">
            <svg viewBox="0 0 500 560" style={{ display: "block", width: "100%" }}
              aria-hidden="true">
              <rect width="500" height="560" fill="var(--forest)" />
              <g stroke="rgba(255,255,255,0.06)" strokeWidth="1">
                <line x1="0" y1="140" x2="500" y2="140" />
                <line x1="0" y1="280" x2="500" y2="280" />
                <line x1="0" y1="420" x2="500" y2="420" />
                <line x1="125" y1="0" x2="125" y2="560" />
                <line x1="250" y1="0" x2="250" y2="560" />
                <line x1="375" y1="0" x2="375" y2="560" />
              </g>
              <rect x="60" y="60" width="220" height="70" rx="8" fill="rgba(239,235,221,0.90)" />
              <text x="80" y="102" fill="var(--forest)" fontFamily="Satoshi, sans-serif"
                fontWeight="700" fontSize="18">FastAPI backend</text>
              <rect x="220" y="180" width="220" height="70" rx="8" fill="rgba(239,235,221,0.90)" />
              <text x="240" y="222" fill="var(--forest)" fontFamily="Satoshi, sans-serif"
                fontWeight="700" fontSize="18">Next.js frontend</text>
              <rect x="70" y="300" width="220" height="70" rx="8" fill="rgba(239,235,221,0.90)" />
              <text x="90" y="342" fill="var(--forest)" fontFamily="Satoshi, sans-serif"
                fontWeight="700" fontSize="18">Tool-routed agent</text>
              <rect x="200" y="420" width="240" height="70" rx="8" fill="rgba(239,235,221,0.90)" />
              <text x="220" y="462" fill="var(--forest)" fontFamily="Satoshi, sans-serif"
                fontWeight="700" fontSize="15">Prophet + XGBoost</text>
            </svg>
          </div>

          {/* Copy */}
          <div>
            <div className="section-eyebrow">/stack</div>
            <h2 className="section-title">Built with tooling that earns its keep</h2>
            <p className="section-sub section-sub--left">
              No layer here is decorative — each one exists because the layer
              below it wasn&apos;t enough on its own.
            </p>

            <div className="stack-list">
              {items.map((item) => (
                <div key={item.title} className="stack-item">
                  <div>
                    <div className="stack-item-title">{item.title}</div>
                    <p className="stack-item-desc">{item.desc}</p>
                  </div>
                  <a href={item.href} className="stack-item-link">
                    Learn more →
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
