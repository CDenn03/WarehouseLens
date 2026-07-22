"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export function LandingHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  // Close menu on resize past mobile breakpoint
  useEffect(() => {
    function onResize() {
      if (window.innerWidth > 860) setMenuOpen(false);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <header
      className="sticky top-0 z-50"
      style={{
        background: "color-mix(in srgb, var(--bg) 88%, transparent)",
        backdropFilter: "saturate(160%) blur(10px)",
        borderBottom: "1px solid var(--border-soft)",
      }}
    >
      <div
        className="mx-auto flex w-full items-center justify-between gap-6 px-6"
        style={{ maxWidth: "var(--maxw)", height: "66px" }}
      >
        {/* Brand */}
        <a
          href="#top"
          className="inline-flex items-baseline gap-px text-base font-bold tracking-tight"
          style={{ color: "var(--ink)" }}
          aria-label="WarehouseLens home"
        >
          WarehouseLens
        </a>

        {/* Desktop nav */}
        <nav
          className="ml-auto mr-2 hidden items-center gap-6 md:flex"
          aria-label="Primary"
        >
          {[
            { href: "#features", label: "Modules" },
            { href: "#who", label: "Who it's for" },
            { href: "#stack", label: "Stack" },
            { href: "#faq", label: "FAQ" },
          ].map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className="text-sm font-medium transition-colors hover:text-[var(--ink)]"
              style={{ color: "var(--ink-soft)" }}
            >
              {label}
            </a>
          ))}
        </nav>

        {/* Desktop actions */}
        <div className="hidden items-center gap-2.5 md:flex">
          <a
            href="#faq"
            className="inline-flex items-center rounded-full border px-5 py-2.5 text-sm font-semibold transition-colors hover:border-[var(--green-900)] hover:text-[var(--green-900)]"
            style={{ borderColor: "var(--border)", color: "var(--ink)" }}
          >
            Contact us
          </a>
          <Link
            href="/dashboard"
            className="inline-flex items-center rounded-full px-5 py-2.5 text-sm font-semibold text-[#f4f3ee] transition-colors hover:opacity-90"
            style={{ background: "var(--green-900)", boxShadow: "0 8px 18px rgba(34,54,30,0.24)" }}
          >
            Sign in
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="flex flex-col gap-1.5 p-2 md:hidden"
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
          onClick={() => setMenuOpen((o) => !o)}
          style={{ background: "none", border: 0 }}
        >
          <span
            className="block h-0.5 w-5.5 rounded-sm transition-transform duration-200"
            style={{
              background: "var(--ink)",
              width: "22px",
              height: "2px",
              transform: menuOpen ? "translateY(7px) rotate(45deg)" : "none",
            }}
          />
          <span
            className="block rounded-sm transition-opacity duration-200"
            style={{
              background: "var(--ink)",
              width: "22px",
              height: "2px",
              opacity: menuOpen ? 0 : 1,
            }}
          />
          <span
            className="block rounded-sm transition-transform duration-200"
            style={{
              background: "var(--ink)",
              width: "22px",
              height: "2px",
              transform: menuOpen ? "translateY(-7px) rotate(-45deg)" : "none",
            }}
          />
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div
          id="mobile-nav"
          className="flex flex-col gap-1 px-6 pb-5 pt-3 md:hidden"
          style={{ borderBottom: "1px solid var(--border-soft)", background: "var(--bg)" }}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("a")) setMenuOpen(false);
          }}
        >
          {[
            { href: "#features", label: "Modules" },
            { href: "#who", label: "Who it's for" },
            { href: "#stack", label: "Stack" },
            { href: "#faq", label: "FAQ" },
          ].map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className="rounded-lg px-1 py-2.5 text-sm font-medium"
              style={{ color: "var(--ink-soft)" }}
            >
              {label}
            </a>
          ))}
          <Link
            href="/dashboard"
            className="mt-2 inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold text-[#f4f3ee]"
            style={{ background: "var(--green-900)" }}
          >
            Sign in
          </Link>
        </div>
      )}
    </header>
  );
}
