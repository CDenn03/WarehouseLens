import { WarehouseLensLogo } from "@/components/WarehouseLensLogo";

const cols = [
  {
    heading: "Product",
    links: [
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
];

export function LandingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-[var(--line)] bg-[var(--bg)]">
      <div className="mx-auto max-w-[var(--maxw)] px-6 py-12 lg:px-10">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <a href="#top" className="inline-block">
              <WarehouseLensLogo variant="horizontal" size={28} />
            </a>
            <p className="mt-3 text-sm text-[var(--ink-mute)]">
              A clear view of operations across every warehouse.
            </p>
          </div>

          {/* Link Columns */}
          {cols.map((col) => (
            <nav key={col.heading}>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--ink-mute)]">
                {col.heading}
              </p>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-[var(--ink-soft)] transition hover:text-[var(--ink)]"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-[var(--line)]">
        <div className="mx-auto flex max-w-[var(--maxw)] flex-col items-center justify-between gap-2 px-6 py-5 text-xs text-[var(--ink-mute)] sm:flex-row lg:px-10">
          <span>© {year} WarehouseLens. All rights reserved.</span>
          <span>Built for teams that outgrew the spreadsheet.</span>
        </div>
      </div>
    </footer>
  );
}
