import "./landing.css";

const roles = [
  {
    label: "Admin",
    desc: "Full visibility across every warehouse, role, and permission.",
    active: false,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    ),
  },
  {
    label: "Warehouse manager",
    desc: "Runs day-to-day operations for the sites they're assigned to.",
    active: true,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </svg>
    ),
  },
  {
    label: "Procurement officer",
    desc: "Owns reordering and supplier relationships, forecast-informed.",
    active: false,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 3v18h18" />
        <path d="m19 9-5 5-4-4-3 3" />
      </svg>
    ),
  },
  {
    label: "Auditor",
    desc: "Read-only trail across every movement, no write access anywhere.",
    active: false,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      </svg>
    ),
  },
] as const;

export function WhoSection() {
  return (
    <section id="who" className="section-wrap--alt">
      <div className="section-inner">
        <div className="section-head">
          <div className="section-eyebrow">/who it&apos;s for</div>
          <h2 className="section-title">Tailored to how you actually operate</h2>
          <p className="section-sub">
            Every role sees exactly the sites and actions it needs —
            nothing borrowed from a generic admin template.
          </p>
        </div>

        <div className="roles-grid">
          {roles.map((role) => (
            <article
              key={role.label}
              className={`role-card ${role.active ? "role-card--active" : "role-card--default"}`}
            >
              <span className={`role-icon ${role.active ? "role-icon--active" : "role-icon--default"}`}>
                {role.icon}
              </span>
              <div className={`role-label ${role.active ? "role-label--active" : "role-label--default"}`}>
                {role.label}
              </div>
              <p className={`role-desc ${role.active ? "role-desc--active" : "role-desc--default"}`}>
                {role.desc}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
