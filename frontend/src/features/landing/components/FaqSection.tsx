"use client";

import { useRef } from "react";

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
    a: "There are four roles — Admin, Warehouse Manager, Procurement Officer, and Auditor. Managers and officers are scoped to the warehouses they're assigned to, and that scope is enforced consistently across the interface, the API, and the copilot.",
  },
  {
    q: "What does it take to get started?",
    a: "Book a demo and we'll stand up a sandbox seeded with sample data so you can click through inventory, procurement, the outbound workflow, and the copilot the same day — no infrastructure on your side to begin.",
  },
] as const;

export function FaqSection() {
  // Keep only one item open at a time
  const refs = useRef<(HTMLDetailsElement | null)[]>([]);

  function handleToggle(index: number) {
    refs.current.forEach((el, i) => {
      if (el && i !== index) el.open = false;
    });
  }

  return (
    <section
      id="faq"
      className="py-14 md:py-20"
      style={{ background: "var(--bg-alt)" }}
    >
      <div className="mx-auto w-full px-6" style={{ maxWidth: "720px" }}>
        <div className="mb-11 text-center">
          <p className="mb-3 text-xs font-semibold" style={{ color: "var(--green-900)" }}>
            /FAQ
          </p>
          <h2
            className="text-2xl font-extrabold tracking-tight md:text-[2.05rem]"
            style={{ color: "var(--ink)" }}
          >
            Questions, answered
          </h2>
        </div>

        <div className="flex flex-col gap-2.5">
          {faqs.map((item, i) => (
            <details
              key={item.q}
              ref={(el) => { refs.current[i] = el; }}
              className="group overflow-hidden rounded-xl bg-[var(--panel)] transition-colors"
              style={{ border: "1px solid var(--border-soft)" }}
              onToggle={() => handleToggle(i)}
            >
              <summary
                className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-[18px] text-base font-semibold"
                style={{ color: "var(--ink)" }}
              >
                {item.q}
                {/* Chevron */}
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rotate-45 transition-transform duration-200 group-open:-rotate-[135deg] group-open:mt-0.5"
                  style={{
                    borderRight: "2px solid var(--ink-mute)",
                    borderBottom: "2px solid var(--ink-mute)",
                    marginTop: "-4px",
                  }}
                />
              </summary>
              <div className="px-5 pb-5 text-[0.97rem]" style={{ color: "var(--ink-soft)" }}>
                <p>{item.a}</p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
