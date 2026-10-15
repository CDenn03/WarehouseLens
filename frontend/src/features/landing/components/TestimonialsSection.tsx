"use client";

const testimonials = [
  {
    quote:
      "We went from weekly stockouts to zero in two months. The AI copilot actually understands our data instead of making things up.",
    author: "Sarah K.",
    role: "Operations Manager",
    company: "Distribution Co.",
    avatar: "SK",
    highlight: "zero stockouts",
  },
  {
    quote:
      "The forecasting finally works for African market patterns. Other tools trained on US retail data completely missed our seasonality.",
    author: "James M.",
    role: "Supply Chain Director",
    company: "AgriTech Kenya",
    avatar: "JM",
    highlight: "African market patterns",
  },
  {
    quote:
      "My team stopped asking me 'where is the X shipment?' — they just ask the copilot. I got 10 hours a week back.",
    author: "Grace N.",
    role: "Warehouse Supervisor",
    company: "FastTrack Logistics",
    avatar: "GN",
    highlight: "10 hours a week",
  },
];

export function TestimonialsSection() {
  return (
    <section className="bg-[var(--bg-alt)] px-6 py-20 lg:px-10">
      <div className="mx-auto max-w-[var(--maxw)]">
        {/* Header */}
        <div className="mb-12 text-center">
          <p className="mb-3 font-mono text-xs tracking-wide text-[var(--ink-mute)]">
            /what teams say
          </p>
          <h2 className="mb-4 text-2xl font-semibold tracking-tight text-[var(--ink)] sm:text-3xl">
            Trusted by warehouse teams
          </h2>
          <p className="mx-auto max-w-lg text-[var(--ink-soft)]">
            From single-site operations to multi-warehouse enterprises.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <article
              key={i}
              className="group relative flex flex-col rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-6 transition hover:border-[var(--sage-deep)] hover:shadow-lg"
            >
              {/* Quote icon */}
              <svg
                className="mb-4 h-8 w-8 text-[var(--sage)]/30"
                viewBox="0 0 32 32"
                fill="currentColor"
              >
                <path d="M10 8c-3.3 0-6 2.7-6 6v10h10V14H8c0-1.1.9-2 2-2V8zm14 0c-3.3 0-6 2.7-6 6v10h10V14h-6c0-1.1.9-2 2-2V8z" />
              </svg>

              {/* Quote */}
              <blockquote className="mb-6 flex-1 text-[var(--ink-soft)] leading-relaxed">
                &ldquo;{t.quote.split(t.highlight)[0]}
                <span className="font-semibold text-[var(--forest)]">{t.highlight}</span>
                {t.quote.split(t.highlight)[1]}&rdquo;
              </blockquote>

              {/* Author */}
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--forest)] text-sm font-semibold text-[var(--ink-on-brand)]">
                  {t.avatar}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--ink)]">{t.author}</p>
                  <p className="text-xs text-[var(--ink-mute)]">
                    {t.role}, {t.company}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
