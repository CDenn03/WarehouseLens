import "./landing.css";

const exchanges = [
  {
    q: "Which SKUs in Nairobi are at risk of stockout this week?",
    a: "3 SKUs are below their reorder point: Packaging Tape 48mm (6 days), Pallet Wrap L (12 days), Corner Guards (4 days). Packaging Tape is most urgent — supplier lead time is 5 days.",
  },
  {
    q: "Draft a purchase order for the critical items.",
    a: "Created PO-2049 (draft) for Acme Trading Co — Packaging Tape 48mm × 200 units, Corner Guards × 150 units. Total: $1,240. Ready to review.",
  },
] as const;

const points = [
  "Scoped to your assigned warehouses",
  "Cites the data source with every answer",
  "Can draft purchase orders from insights",
  "Benchmarked against a gold-answer eval suite",
] as const;

export function CopilotSection() {
  return (
    <section id="copilot" className="section-wrap--dark">
      <div className="copilot-inner">
        {/* Copy */}
        <div>
          <div className="section-eyebrow section-eyebrow--light">/ai copilot</div>
          <h2 className="section-title section-title--light">
            Ask questions in plain language.
            <br />
            Get answers from real data.
          </h2>
          <p className="section-sub section-sub--light">
            The copilot routes every question to a purpose-built tool against
            the live database — no hallucinated numbers, no free-form SQL.
          </p>
          <ul className="copilot-points">
            {points.map((p) => (
              <li key={p} className="copilot-point">
                <svg className="copilot-point-dot" viewBox="0 0 16 16" fill="none"
                  stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
                  strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 8l3.5 3.5L13 4" />
                </svg>
                {p}
              </li>
            ))}
          </ul>
        </div>

        {/* Chat panel */}
        <div className="chat-panel">
          <div className="chat-header">
            <div className="chat-header-brand">
              <span className="chat-header-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="#a8c29c" strokeWidth="2" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm3.75 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm3.75 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM21 12c0 4.556-4.03 8.25-9 8.25a9.76 9.76 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
              </span>
              Warehouse Copilot
            </div>
            <div className="chat-live">
              <span className="chat-live-dot" />
              Live
            </div>
          </div>

          <div className="chat-messages">
            {exchanges.map((ex, i) => (
              <div key={i} className="chat-exchange">
                <div className="chat-user">
                  <div className="chat-user-bubble">{ex.q}</div>
                </div>
                <div className="chat-assistant">
                  <div className="chat-assistant-bubble">{ex.a}</div>
                </div>
              </div>
            ))}
            <div className="chat-assistant">
              <div className="chat-typing">
                <span className="chat-typing-dot" />
                <span className="chat-typing-dot" />
                <span className="chat-typing-dot" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
