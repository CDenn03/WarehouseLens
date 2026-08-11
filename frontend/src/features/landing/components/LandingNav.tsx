import Link from "next/link";
import { WarehouseLensLogo } from "@/components/WarehouseLensLogo";

export default function LandingNav() {
  return (
    <nav className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
      <div className="flex items-center gap-2">
        <WarehouseLensLogo variant="horizontal" size={28} />
      </div>
      <div className="hidden items-center gap-8 text-sm text-[var(--ink-soft)] md:flex">
        <span>Platform</span>
        <span>Solutions</span>
        <span>Customers</span>
        <span>Pricing</span>
      </div>
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="rounded-lg bg-[var(--forest)] px-4 py-2 text-sm font-medium text-[var(--ink-on-brand)]"
        >
          Sign in
        </Link>
      </div>
    </nav>
  );
}
