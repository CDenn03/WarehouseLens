const exchanges = [
  {
    q: "Which SKUs in Nairobi are at risk of stockout this week?",
    a: "3 SKUs are below their reorder point: Packaging Tape 48mm (6 days), Pallet Wrap L (12 days), Corner Guards (4 days). Packaging Tape is most urgent — supplier lead time is 5 days.",
  },
  {
    q: "Draft a purchase order for the critical items.",
    a: "Created PO-2049 (draft) for Acme Trading Co — Packaging Tape 48mm × 200 units, Corner Guards × 150 units. Total: $1,240. Ready to review.",
  },
];

const points = [
  "Scoped to your assigned warehouses",
  "Cites the data source with every answer",
  "Can draft purchase orders from insights",
  "Benchmarked against a gold-answer eval suite",
];

export function CopilotSection() {
  return (
    <section id="copilot" className="bg-[var(--forest)] px-6 py-20 lg:px-10">
      <div className="mx-auto grid max-w-[var(--maxw)] gap-12 lg:grid-cols-2 lg:items-center">
        {/* Copy */}
        <div>
          <p className="mb-3 font-mono text-xs tracking-wide text-[var(--sage)]">/ai copilot</p>
          <h2 className="mb-4 text-2xl font-semibold tracking-tight text-[var(--ink-on-brand)] sm:text-3xl">
            Ask questions in plain language.
            <br />
            Get answers from real data.
          </h2>
          <p className="mb-6 max-w-md text-white/60">
            The copilot routes every question to a purpose-built tool against the live database — no hallucinated
            numbers, no free-form SQL.
          </p>
          <ul className="space-y-2.5">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-2 text-sm text-white/70">
                <svg
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--sage)]"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 8l3.5 3.5L13 4" />
                </svg>
                {p}
              </li>
            ))}
          </ul>
        </div>

        {/* Chat Panel */}
        <div className="rounded-md border border-white/10 bg-white/[0.04]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
            <div className="flex items-center gap-2 text-sm font-medium text-white/80">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/10">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a8c29c" strokeWidth="2">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm3.75 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm3.75 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM21 12c0 4.556-4.03 8.25-9 8.25a9.76 9.76 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
                  />
                </svg>
              </span>
              Warehouse Copilot
            </div>
            <span className="flex items-center gap-1.5 text-xs text-[var(--sage)]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              Live
            </span>
          </div>

          {/* Messages */}
          <div className="space-y-4 p-5">
            {exchanges.map((ex, i) => (
              <div key={i} className="space-y-3">
                {/* User */}
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-md bg-white/10 px-4 py-2.5 text-sm text-white/90">
                    {ex.q}
                  </div>
                </div>
                {/* Assistant */}
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-md bg-white/[0.06] px-4 py-2.5 text-sm leading-relaxed text-white/70">
                    {ex.a}
                  </div>
                </div>
              </div>
            ))}
            {/* Typing indicator */}
            <div className="flex justify-start">
              <div className="flex gap-1 rounded-2xl bg-white/[0.06] px-4 py-3">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/40 [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/40 [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/40" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
