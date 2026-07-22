const roles = [
  {
    label: "Admin",
    desc: "Full visibility across every warehouse, role, and permission.",
    active: false,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M9 12h6" />
      </svg>
    ),
  },
  {
    label: "Warehouse manager",
    desc: "Runs day-to-day operations for the sites they're assigned to.",
    active: true,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      </svg>
    ),
  },
] as const;

export function WhoSection() {
  return (
    <section
      id="who"
      className="py-14 md:py-20"
      style={{ background: "var(--bg-alt)" }}
    >
      <div className="mx-auto w-full px-6" style={{ maxWidth: "var(--maxw)" }}>
        {/* Section head */}
        <div className="mb-10 flex flex-wrap items-end justify-between gap-8">
          <div>
            <p className="mb-3 text-xs font-semibold" style={{ color: "var(--green-900)" }}>
              /Who it&apos;s for
            </p>
            <h2
              className="text-2xl font-extrabold tracking-tight md:text-[2.1rem]"
              style={{ color: "var(--ink)" }}
            >
              Tailored to how you
              <br />
              actually operate
            </h2>
          </div>
          <p
            className="max-w-[380px] text-right text-base"
            style={{ color: "var(--ink-soft)" }}
          >
            Every role sees exactly the sites and actions it needs — nothing
            borrowed from a generic admin template.
          </p>
        </div>

        {/* Role cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {roles.map((role) => (
            <article
              key={role.label}
              className="rounded-xl p-6 transition-all duration-150 hover:-translate-y-1"
              style={
                role.active
                  ? {
                      background: "var(--green-900)",
                      border: "1px solid var(--green-900)",
                      boxShadow: "var(--shadow)",
                    }
                  : {
                      background: "var(--panel)",
                      border: "1px solid var(--border-soft)",
                    }
              }
            >
              {/* Icon badge */}
              <span
                className="mb-5 inline-grid h-10 w-10 place-items-center rounded-xl"
                style={
                  role.active
                    ? { background: "rgba(244,243,238,0.12)", color: "#f4f3ee" }
                    : { background: "var(--green-100)", color: "var(--green-900)" }
                }
              >
                {role.icon}
              </span>
              <h3
                className="mb-1.5 text-[1.02rem] font-bold"
                style={{ color: role.active ? "#f4f3ee" : "var(--ink)" }}
              >
                {role.label}
              </h3>
              <p
                className="text-sm"
                style={{ color: role.active ? "rgba(244,243,238,0.8)" : "var(--ink-soft)" }}
              >
                {role.desc}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
