import Link from "next/link";

export default function LandingNav() {
  return (
    <nav className="nav-bar">
      <div className="nav-brand">
        <span className="nav-brand-dot" />
        WarehouseLens
      </div>
      <div className="nav-links">
        <span>Platform</span>
        <span>Solutions</span>
        <span>Customers</span>
        <span>Pricing</span>
      </div>
      <div className="nav-actions">
        <button className="btn-outline">Contact us</button>
        <Link href="/dashboard" className="btn-primary">
          Sign in
        </Link>
      </div>
    </nav>
  );
}
