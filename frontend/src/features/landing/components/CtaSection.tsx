import Link from "next/link";

export function CtaSection() {
  return (
    <section className="px-6 py-20 lg:px-10">
      <div className="mx-auto max-w-[var(--maxw)]">
        <div className="overflow-hidden rounded-3xl bg-[var(--forest)] px-8 py-16 text-center sm:px-16">
          <p className="mb-3 font-mono text-xs tracking-wide text-[var(--sage)]">/get started</p>
          <h2 className="mb-4 text-2xl font-semibold tracking-tight text-[var(--ink-on-brand)] sm:text-3xl">
            Ready to see it with
            <br />
            your own warehouse?
          </h2>
          <p className="mx-auto mb-8 max-w-lg text-white/60">
            We'll provision a sandbox seeded with realistic data — inventory, suppliers, outbound orders, forecasts —
            so you can evaluate the full workflow before touching your own data.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 rounded-full bg-[var(--ink-on-brand)] px-6 py-3 text-sm font-semibold text-[var(--forest)] transition hover:opacity-90"
          >
            Sign in →
          </Link>
        </div>
      </div>
    </section>
  );
}
