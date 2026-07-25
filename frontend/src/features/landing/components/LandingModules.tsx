import FeatureCard from "./FeatureCard";

export default function LandingModules() {
  return (
    <section id="modules" className="landing-modules">
      <div className="landing-modules__head">
        <div className="landing-modules__eyebrow">/see it in action</div>
        <h2 className="landing-modules__title">Built for every corner of your warehouse</h2>
      </div>

      <div className="landing-modules__grid">
        <FeatureCard eyebrow="Inventory" title="Cargo container" subtitle="WHL 0248113 · Nairobi">
          <div className="module-bars">
            {[88, 64, 95, 30, 18, 72, 12].map((h, i) => (
              <div
                key={i}
                className="module-bar"
                style={{
                  height: `${h}%`,
                  background: h > 50 ? "var(--sage)" : "rgba(239,235,221,0.16)",
                }}
              />
            ))}
          </div>
          <div className="module-meta">1,842 units · 79% capacity</div>
        </FeatureCard>

        <FeatureCard eyebrow="Fulfillment" title="Pick station" subtitle="Order #SO-4892 · Packing">
          {[
            { label: "Packing tape 48mm", pct: "100%", text: "12/12" },
            { label: "Pallet wrap L", pct: "75%", text: "9/12" },
            { label: "Corner guards", pct: "33%", text: "4/12" },
          ].map((item) => (
            <div key={item.label} className="module-pick">
              <div className="module-pick-label">
                <span>{item.label}</span>
                <span>{item.text}</span>
              </div>
              <div className="module-pick-track">
                <div className="module-pick-fill" style={{ width: item.pct }} />
              </div>
            </div>
          ))}
        </FeatureCard>

        <FeatureCard eyebrow="Procurement" title="Procurement" subtitle="PO-2048 · Draft reorder">
          <div className="module-proc-grid">
            <div className="module-proc-tile">
              <div className="module-proc-num">6</div>
              <div className="module-proc-lbl">low stock alerts</div>
            </div>
            <div className="module-proc-tile">
              <div className="module-proc-num">3</div>
              <div className="module-proc-lbl">pending approval</div>
            </div>
            <div className="module-proc-tile module-proc-tile--po">
              <div className="module-proc-num">PO</div>
              <div className="module-proc-lbl">2048 · draft</div>
            </div>
            <div className="module-proc-tile">
              <div className="module-proc-num">2d</div>
              <div className="module-proc-lbl">avg. lead time</div>
            </div>
          </div>
        </FeatureCard>

        <FeatureCard variant="light" eyebrow="Forecasting" title="Forecasting" subtitle="14-day Prophet model">
          <div className="module-fc-headline">+18%</div>
          <div className="module-fc-sub">projected demand, next 14 days</div>
          <svg
            className="module-fc-chart"
            width="100%"
            height="70"
            viewBox="0 0 220 70"
          >
            <polyline
              points="0,50 30,42 55,48 80,30 105,36 130,22 160,26 190,10 220,6"
              fill="none"
              stroke="#17241A"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="220" cy="6" r="4" fill="#17241A" />
          </svg>
        </FeatureCard>
      </div>
    </section>
  );
}
