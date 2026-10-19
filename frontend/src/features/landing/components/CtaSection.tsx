import Link from "next/link";

export function CtaSection() {
  return (
    <section className="px-6 py-20 lg:px-10">
      <div className="mx-auto max-w-[var(--maxw)]">
        <div className="overflow-hidden rounded-md border border-[var(--line)] bg-[var(--forest)] px-8 py-16 text-center sm:px-16">
          <p className="mb-3 font-mono text-xs tracking-wide text-[var(--sage)]">/get started</p>
          <h2 className="mb-4 text-2xl font-semibold tracking-tight text-[var(--ink-on-brand)] sm:text-3xl">
            Ready to work from one operational picture?
          </h2>
          <p className="mx-auto mb-8 max-w-lg text-white/60">
            Open the workspace to explore the product, then use the same structure to model your own warehouses, roles, and workflow.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 rounded-md bg-[var(--ink-on-brand)] px-6 py-3 text-sm font-semibold text-[var(--forest)] transition hover:opacity-90"
          >
            Open the workspace →
          </Link>
        </div>
      </div>
    </section>
  );
}
