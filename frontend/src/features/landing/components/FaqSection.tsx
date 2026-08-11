const faqs = [
  {
    q: "Is the AI copilot safe to trust with real numbers?",
    a: "Yes — by design it can't make numbers up. The copilot never writes its own database queries. It chooses a purpose-built tool, that tool runs a fixed, reviewed query, and the answer is generated only from those results. It's also held to the same role and warehouse permissions as the person asking.",
  },
  {
    q: "How many warehouses can it handle?",
    a: "Multi-warehouse isn't an add-on — it's the core model. Stock, purchase orders, reorder points, and forecasts are all tracked per site, so adding another warehouse is a setup step, not a migration.",
  },
  {
    q: "How does the demand forecasting work?",
    a: "Each product's movement history feeds a per-warehouse Prophet model, benchmarked against an XGBoost comparison and a naive baseline so you can see it's actually earning its keep. Forecasts refresh in the background and surface right where you plan reorders.",
  },
  {
    q: "Can I control who sees what?",
    a: "There are six roles — Platform Admin, Tenant Admin, Admin, Warehouse Manager, Procurement Officer, and Auditor. Managers and officers are scoped to the warehouses they're assigned to, and that scope is enforced consistently across the interface, the API, and the copilot.",
  },
  {
    q: "What does it take to get started?",
    a: "Book a demo and we'll stand up a sandbox seeded with sample data so you can click through inventory, procurement, the outbound workflow, and the copilot the same day — no infrastructure on your side to begin.",
  },
];

export function FaqSection() {
  return (
    <section id="faq" className="bg-[var(--bg-alt)] px-6 py-20 lg:px-10">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-10 text-center">
          <p className="mb-3 font-mono text-xs tracking-wide text-[var(--ink-mute)]">/faq</p>
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--ink)] sm:text-3xl">
            Questions, answered
          </h2>
        </div>

        {/* FAQ Items */}
        <div className="divide-y divide-[var(--line)]">
          {faqs.map((item) => (
            <details key={item.q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-[var(--ink)] marker:hidden">
                {item.q}
                <svg
                  className="h-5 w-5 shrink-0 text-[var(--ink-mute)] transition group-open:rotate-45"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M10 4v12M4 10h12" strokeLinecap="round" />
                </svg>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-[var(--ink-soft)]">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
