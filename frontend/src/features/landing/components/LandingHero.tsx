const warehouses = [
  { name: "Nairobi", status: "Healthy", color: "#A8C29C", bg: "rgba(168,194,156,0.12)" },
  { name: "Mombasa", status: "Low stock — 2 items below reorder", color: "#E8A96A", bg: "rgba(232,169,106,0.14)" },
  { name: "Kisumu", status: "Healthy", color: "#A8C29C", bg: "rgba(168,194,156,0.12)" },
];

const reorderRisks = [
  { item: "Packaging Tape", days: 6, severity: "critical" as const },
  { item: "Pallet Wrap", days: 12, severity: "warning" as const },
  { item: "Steel Straps", days: 18, severity: "ok" as const },
];

const severityColor: Record<string, string> = {
  critical: "#E87C5A",
  warning: "#E8A96A",
  ok: "#A8C29C",
};

const severityLabel: Record<string, string> = {
  critical: "Reorder now",
  warning: "Order soon",
  ok: "Sufficient",
};

export default function LandingHero() {
  return (
    <header className="hero-fullbleed">
      <div className="hero-inner">
        <div className="hero-left">
          <div className="hero-eyebrow">
            <span className="hero-eyebrow-dot" />
            MULTI-WAREHOUSE OPERATIONS
          </div>
          <h1 className="hero-title">
            Know what&apos;s happening
            <br />
            across every warehouse.
          </h1>
          <p className="hero-sub">
            Monitor inventory, procurement, fulfillment, and warehouse performance from a single
            workspace. Real-time visibility into stock levels, operational risks, and
            purchasing decisions across every site.
          </p>
          <div className="hero-btns">
            <button className="btn-primary">Request Demo</button>
            <a href="#modules" className="btn-outline">
              See how it works
            </a>
          </div>
        </div>

        <div className="hero-right">
          <div className="heroPanel">
            <div className="hero-panel-header">
              <span>Warehouse Overview</span>
              <span className="hero-panel-live">
                <span className="hero-panel-live-dot" />
                Live
              </span>
            </div>

            <div className="hero-panel-section">
              <div className="hero-panel-label">Warehouse Status</div>
              {warehouses.map((w) => (
                <div key={w.name} className="hero-panel-row" style={{ background: w.bg }}>
                  <span className="hero-panel-row-name">{w.name}</span>
                  <span className="hero-panel-row-status" style={{ color: w.color }}>
                    {w.status}
                  </span>
                </div>
              ))}
            </div>

            <div className="hero-panel-section">
              <div className="hero-panel-label">Reorder Risks</div>
              {reorderRisks.map((r) => {
                const color = severityColor[r.severity];
                return (
                  <div key={r.item} className="hero-risk">
                    <div className="hero-risk-header">
                      <span className="hero-risk-name">{r.item}</span>
                      <span className="hero-risk-status" style={{ color }}>
                        {r.days} days — {severityLabel[r.severity]}
                      </span>
                    </div>
                    <div className="hero-risk-track">
                      <div
                        className="hero-risk-fill"
                        style={{
                          width: `${Math.min(100, (1 - r.days / 30) * 100)}%`,
                          background: color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
              <div className="hero-risk-legend">
                <span className="hero-legend-item">
                  <span className="hero-legend-bar" style={{ background: "#E87C5A" }} />
                  {"< 7d"}
                </span>
                <span className="hero-legend-item">
                  <span className="hero-legend-bar" style={{ background: "#E8A96A" }} />
                  7–14d
                </span>
                <span className="hero-legend-item">
                  <span className="hero-legend-bar" style={{ background: "#A8C29C" }} />
                  {" > 14d"}
                </span>
              </div>
            </div>

            <div className="hero-panel-footer">
              <div>
                <div className="hero-panel-footer-label">Inventory Health</div>
                <div className="hero-panel-footer-stat">96%</div>
              </div>
              <div className="hero-panel-footer-note">Across 3 warehouses</div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
