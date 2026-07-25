import "./landing.css";

const cols = [
  {
    heading: "Product",
    links: [
      { href: "#modules", label: "Modules" },
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
] as const;

export function LandingFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="landing-footer">
      <div className="footer-inner">
        <div>
          <a href="#top" className="footer-brand">
            <span className="footer-brand-dot" />
            WarehouseLens
          </a>
          <p className="footer-tagline">Warehouse operations, with an AI copilot.</p>
        </div>

        <nav className="footer-links" aria-label="Footer">
          {cols.map((col) => (
            <div key={col.heading}>
              <div className="footer-col-heading">{col.heading}</div>
              <ul className="footer-col-list">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="footer-link">{link.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="footer-bottom">
        <span>© {year} WarehouseLens. All rights reserved.</span>
        <span>Built for teams that outgrew the spreadsheet.</span>
      </div>
    </footer>
  );
}
