import "./landing.css";

const stats = [
  { value: "3", unit: "warehouses", desc: "managed from one workspace" },
  { value: "24", unit: "SKUs", desc: "tracked with per-site reorder points" },
  { value: "14-day", unit: "forecast", desc: "Prophet + XGBoost, benchmarked" },
  { value: "6", unit: "roles", desc: "scoped to site and capability" },
] as const;

export function StatsSection() {
  return (
    <div className="stats-bar">
      <div className="stats-grid">
        {stats.map((s) => (
          <div key={s.unit} className="stat-cell">
            <div className="stat-value">{s.value}</div>
            <div className="stat-unit">{s.unit}</div>
            <div className="stat-desc">{s.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
