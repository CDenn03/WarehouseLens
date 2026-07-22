const stackItems = [
  {
    title: "Real-time inventory",
    desc: "Stock levels update the moment a movement posts, per warehouse.",
    href: "#features",
  },
  {
    title: "Forecast benchmarking",
    desc: "Prophet is only shipped once it beats XGBoost and a naive baseline.",
    href: "#faq",
  },
  {
    title: "Automated reorder drafts",
    desc: "The copilot can draft a PO from a low-stock answer, one click away.",
    href: "#features",
  },
  {
    title: "Scoped access",
    desc: "The same warehouse scope is enforced in the UI, API, and copilot.",
    href: "#who",
  },
] as const;

export function StackSection() {
  return (
    <section id="stack" className="py-14 md:py-20">
      <div className="mx-auto w-full px-6" style={{ maxWidth: "var(--maxw)" }}>
        <div className="grid items-center gap-12 lg:grid-cols-[0.85fr_1.15fr]">
          {/* Illustration */}
          <div
            className="overflow-hidden rounded-2xl"
            style={{ boxShadow: "var(--shadow-lg)" }}
          >
            <svg
              viewBox="0 0 500 560"
              className="h-auto w-full"
              aria-hidden="true"
            >
              <rect width="500" height="560" rx="16" fill="#22361e" />
              <g stroke="rgba(255,255,255,0.08)" strokeWidth="1">
                <line x1="0" y1="140" x2="500" y2="140" />
                <line x1="0" y1="280" x2="500" y2="280" />
                <line x1="0" y1="420" x2="500" y2="420" />
                <line x1="125" y1="0" x2="125" y2="560" />
                <line x1="250" y1="0" x2="250" y2="560" />
                <line x1="375" y1="0" x2="375" y2="560" />
              </g>
              <rect x="60" y="60" width="220" height="70" rx="8" fill="rgba(233,239,230,0.9)" />
              <text x="80" y="102" fill="#22361e" fontFamily="Inter, sans-serif" fontWeight="700" fontSize="18">FastAPI backend</text>
              <rect x="220" y="180" width="220" height="70" rx="8" fill="rgba(233,239,230,0.9)" />
              <text x="240" y="222" fill="#22361e" fontFamily="Inter, sans-serif" fontWeight="700" fontSize="18">Next.js frontend</text>
              <rect x="70" y="300" width="220" height="70" rx="8" fill="rgba(233,239,230,0.9)" />
              <text x="90" y="342" fill="#22361e" fontFamily="Inter, sans-serif" fontWeight="700" fontSize="18">Tool-routed agent</text>
              <rect x="200" y="420" width="240" height="70" rx="8" fill="rgba(233,239,230,0.9)" />
              <text x="220" y="462" fill="#22361e" fontFamily="Inter, sans-serif" fontWeight="700" fontSize="15">Prophet + XGBoost</text>
            </svg>
          </div>

          {/* Copy */}
          <div>
            <p className="mb-3 text-xs font-semibold" style={{ color: "var(--green-900)" }}>
              /Stack
            </p>
            <h2
              className="text-2xl font-extrabold tracking-tight md:text-[2.1rem]"
              style={{ color: "var(--ink)" }}
            >
              Built with tooling that
              <br />
              earns its keep
            </h2>
            <p className="mt-3 max-w-[46ch] text-base" style={{ color: "var(--ink-soft)" }}>
              No layer here is decorative — each one exists because the layer
              below it wasn&apos;t enough on its own.
            </p>

            <div className="mt-7 flex flex-col">
              {stackItems.map((item, i) => (
                <div
                  key={item.title}
                  className="flex items-start justify-between gap-5 py-5"
                  style={{
                    borderTop: "1px solid var(--border-soft)",
                    borderBottom: i === stackItems.length - 1 ? "1px solid var(--border-soft)" : undefined,
                  }}
                >
                  <div>
                    <h3 className="mb-1 text-base font-bold" style={{ color: "var(--ink)" }}>
                      {item.title}
                    </h3>
                    <p className="max-w-[42ch] text-[0.9rem]" style={{ color: "var(--ink-soft)" }}>
                      {item.desc}
                    </p>
                  </div>
                  <a
                    href={item.href}
                    className="group inline-flex shrink-0 items-center gap-1.5 pt-0.5 text-sm font-semibold transition-[gap] hover:gap-2.5"
                    style={{ color: "var(--green-900)" }}
                  >
                    Learn more <span aria-hidden="true">{"→"}</span>
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
