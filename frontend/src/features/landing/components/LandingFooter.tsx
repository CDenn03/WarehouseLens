export function LandingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer style={{ background: "var(--bg-alt)", borderTop: "1px solid var(--border-soft)" }}>
      <div
        className="mx-auto grid w-full gap-10 px-6 pb-9 pt-14 md:grid-cols-[1.4fr_2fr]"
        style={{ maxWidth: "var(--maxw)" }}
      >
        {/* Brand + tagline */}
        <div>
          <a
            href="#top"
            className="inline-flex items-baseline gap-px text-base font-bold tracking-tight"
            style={{ color: "var(--ink)" }}
            aria-label="WarehouseLens home"
          >
            WarehouseLens
          </a>
          <p className="mt-3.5 max-w-[260px] text-[0.94rem]" style={{ color: "var(--ink-mute)" }}>
            Warehouse operations, with an AI copilot.
          </p>
        </div>

        {/* Link columns */}
        <nav
          className="grid grid-cols-3 gap-6"
          aria-label="Footer"
        >
          {[
            {
              heading: "Product",
              links: [
                { href: "#features", label: "Modules" },
                { href: "#who", label: "Who it's for" },
                { href: "#faq", label: "FAQ" },
              ],
            },
            {
              heading: "Company",
              links: [
                { href: "#", label: "About" },
                { href: "#", label: "Careers" },
                { href: "#", label: "Contact" },
              ],
            },
            {
              heading: "Legal",
              links: [
                { href: "#", label: "Privacy" },
                { href: "#", label: "Terms" },
                { href: "#", label: "Security" },
              ],
            },
          ].map((col) => (
            <div key={col.heading} className="flex flex-col gap-2.5">
              <h4
                className="mb-1 text-[0.78rem] font-semibold uppercase tracking-wider"
                style={{ color: "var(--ink-mute)" }}
              >
                {col.heading}
              </h4>
              {col.links.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-[0.94rem] transition-colors hover:text-[var(--green-900)]"
                  style={{ color: "var(--ink-soft)" }}
                >
                  {link.label}
                </a>
              ))}
            </div>
          ))}
        </nav>
      </div>

      {/* Bottom bar */}
      <div
        className="mx-auto flex w-full flex-wrap items-center justify-between gap-2 px-6 py-5"
        style={{
          maxWidth: "var(--maxw)",
          borderTop: "1px solid var(--border-soft)",
          color: "var(--ink-mute)",
          fontSize: "0.87rem",
        }}
      >
        <p>© {year} WarehouseLens. All rights reserved.</p>
        <p>Built for teams that outgrew the spreadsheet.</p>
      </div>
    </footer>
  );
}
