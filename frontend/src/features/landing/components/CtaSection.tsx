import Link from "next/link";

export function CtaSection() {
  return (
    <section className="px-6 py-20 lg:px-10">
      <div className="mx-auto max-w-[var(--maxw)]">
        <div className="relative overflow-hidden rounded-3xl bg-[var(--forest)] px-8 py-16 text-center sm:px-16">
          {/* Decorative elements */}
          <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-[var(--sage)]/10 blur-3xl" />
          <div className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-white/5 blur-3xl" />

          <div className="relative">
            <p className="mb-3 font-mono text-xs tracking-wide text-[var(--sage)]">/get started</p>
            <h2 className="mb-4 text-2xl font-semibold tracking-tight text-[var(--ink-on-brand)] sm:text-3xl lg:text-4xl">
              See your warehouses clearly.
              <br />
              <span className="text-[var(--sage)]">Starting today.</span>
            </h2>
            <p className="mx-auto mb-8 max-w-xl text-white/60">
              Get a sandbox pre-loaded with realistic inventory data, supplier records, and outbound
              orders. Test the full workflow — forecasting, copilot, everything — before touching
              your production data.
            </p>

            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/signin"
                className="inline-flex items-center gap-2 rounded-full bg-[var(--ink-on-brand)] px-8 py-3.5 text-sm font-semibold text-[var(--forest)] shadow-lg transition hover:opacity-90"
              >
                Start free trial
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M3 8h10M9 4l4 4-4 4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
              <a
                href="#copilot"
                className="inline-flex items-center gap-2 text-sm font-medium text-white/70 transition hover:text-white"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <circle cx="8" cy="8" r="6" />
                  <path d="M6.5 6.5l3 3M9.5 6.5l-3 3" strokeLinecap="round" />
                </svg>
                See the AI copilot in action
              </a>
            </div>

            {/* Trust badges */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-xs text-white/40">
              <span className="flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M13 4L6 11l-3-3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                No credit card
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="8" cy="8" r="6" />
                  <path d="M8 5v3l2 1" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                5-minute setup
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="2" y="4" width="12" height="8" rx="1" />
                  <path d="M5 8h6" strokeLinecap="round" />
                </svg>
                Cancel anytime
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
