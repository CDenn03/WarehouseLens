import Link from "next/link";
import "./landing.css";

export function CtaSection() {
  return (
    <div className="cta-wrap">
      <div className="cta-card">
        <div className="section-eyebrow section-eyebrow--light">/get started</div>
        <h2 className="cta-title">
          Ready to see it with
          <br />
          your own warehouse?
        </h2>
        <p className="cta-sub">
          We'll provision a sandbox seeded with realistic data — inventory,
          suppliers, outbound orders, forecasts — so you can evaluate the
          full workflow before touching your own data.
        </p>
        <div className="cta-actions">
          <Link href="/dashboard" className="btn-primary-inverse">
            Sign in →
          </Link>
          <a href="#faq" className="btn-outline-inverse">
            Read the FAQ
          </a>
        </div>
      </div>
    </div>
  );
}
