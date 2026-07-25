import "./landing.css";

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
] as const;

export function FaqSection() {
  return (
    <section id="faq" className="section-wrap--alt">
      <div className="section-inner">
        <div className="section-head">
          <div className="section-eyebrow">/faq</div>
          <h2 className="section-title">Questions, answered</h2>
        </div>

        <div className="faq-list">
          {faqs.map((item) => (
            <details key={item.q} className="faq-item">
              <summary className="faq-summary">
                {item.q}
                <span className="faq-chevron" />
              </summary>
              <div className="faq-body">{item.a}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
