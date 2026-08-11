const roles = [
  {
    label: "Admin",
    desc: "Full visibility across every warehouse, role, and permission.",
    active: false,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      </svg>
    ),
  },
];

export function WhoSection() {
  return (
    <section id="who" className="bg-[var(--bg-alt)] px-6 py-20 lg:px-10">
      <div className="mx-auto max-w-[var(--maxw)]">
        {/* Header */}
        <div className="mb-12 text-center">
          <p className="mb-3 font-mono text-xs tracking-wide text-[var(--ink-mute)]">/who it&apos;s for</p>
          <h2 className="mb-3 text-2xl font-semibold tracking-tight text-[var(--ink)] sm:text-3xl">
            Tailored to how you actually operate
          </h2>
          <p className="mx-auto max-w-lg text-[var(--ink-soft)]">
            Every role sees exactly the sites and actions it needs — nothing borrowed from a generic admin template.
          </p>
        </div>

        {/* Roles Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {roles.map((role) => (
            <article
              key={role.label}
              className={`rounded-2xl border p-5 transition ${
                role.active
                  ? "border-[var(--forest)] bg-[var(--forest)] text-[var(--ink-on-brand)]"
                  : "border-[var(--line)] bg-[var(--panel)] text-[var(--ink)]"
              }`}
            >
              <span
                className={`mb-4 flex h-10 w-10 items-center justify-center rounded-lg ${
                  role.active ? "bg-white/10 text-[var(--sage)]" : "bg-[var(--bg-alt)] text-[var(--ink-soft)]"
                }`}
              >
                {role.icon}
              </span>
              <p className="mb-1 font-medium">{role.label}</p>
              <p className={`text-sm ${role.active ? "text-white/60" : "text-[var(--ink-mute)]"}`}>
                {role.desc}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
