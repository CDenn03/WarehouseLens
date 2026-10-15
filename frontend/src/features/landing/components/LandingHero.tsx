"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

const metrics = [
  { label: "Inventory accuracy", value: "99.2%", trend: "+2.4%" },
  { label: "Stockout incidents", value: "3", trend: "-67%" },
  { label: "Order fulfillment", value: "98.7%", trend: "+5.1%" },
];

const warehouses = [
  { name: "Nairobi Central", status: "healthy", items: "12,450", capacity: 78 },
  { name: "Mombasa Port", status: "warning", items: "8,230", capacity: 92 },
  { name: "Kisumu West", status: "healthy", items: "5,120", capacity: 65 },
];

const reorderAlerts = [
  { sku: "PKG-TAPE-48", name: "Packaging Tape 48mm", days: 4, severity: "critical" as const },
  { sku: "PLT-WRAP-L", name: "Pallet Wrap Large", days: 11, severity: "warning" as const },
  { sku: "STL-STRAP", name: "Steel Strapping", days: 19, severity: "ok" as const },
];

const severityConfig = {
  critical: { color: "text-red-400", bg: "bg-red-500/20", dot: "bg-red-400" },
  warning: { color: "text-amber-400", bg: "bg-amber-500/20", dot: "bg-amber-400" },
  ok: { color: "text-emerald-400", bg: "bg-emerald-500/20", dot: "bg-emerald-400" },
};

export default function LandingHero() {
  const [activeMetric, setActiveMetric] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveMetric((prev) => (prev + 1) % metrics.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative overflow-hidden bg-[var(--bg)]">
      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative mx-auto max-w-[var(--maxw)] px-6 py-16 lg:px-10 lg:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          {/* Left: Copy */}
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-sm">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500">
                <span className="h-2 w-2 animate-ping rounded-full bg-emerald-400" />
              </span>
              <span className="text-[var(--ink-soft)]">AI-powered forecasting</span>
            </div>

            <h1 className="mb-6 text-4xl font-semibold leading-[1.08] tracking-tight text-[var(--ink)] sm:text-5xl lg:text-[3.5rem]">
              Stop guessing what&apos;s in your{" "}
              <span className="text-[var(--sage-deep)]">warehouses</span>
            </h1>

            <p className="mb-8 max-w-lg text-lg leading-relaxed text-[var(--ink-soft)]">
              Real-time inventory visibility across every site. An AI copilot that answers from your
              actual data — not hallucinated numbers. Know what&apos;s running low{" "}
              <em>before</em> it&apos;s a problem.
            </p>

            <div className="mb-10 flex flex-wrap gap-3">
              <Link
                href="/signin"
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--forest)] px-6 py-3 text-sm font-semibold text-[var(--ink-on-brand)] shadow-lg transition hover:opacity-90"
              >
                Start free trial
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M3 8h10M9 4l4 4-4 4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
              <a
                href="#how"
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-6 py-3 text-sm font-medium text-[var(--ink)] transition hover:border-[var(--forest)] hover:text-[var(--forest)]"
              >
                See how it works
              </a>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[var(--ink-mute)]">
              <span className="flex items-center gap-1.5">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path
                    d="M13 4L6 11l-3-3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                No credit card required
              </span>
              <span className="flex items-center gap-1.5">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <circle cx="8" cy="8" r="6" />
                  <path d="M8 5v3l2 1" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                5-minute setup
              </span>
              <span className="flex items-center gap-1.5">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path
                    d="M8 1v14M1 8h14"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Multi-warehouse ready
              </span>
            </div>
          </div>

          {/* Right: Dashboard Preview */}
          <div className="relative">
            {/* Glow effect */}
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-[var(--sage)]/20 via-transparent to-[var(--forest)]/10 blur-2xl" />

            <div className="relative rounded-2xl border border-[var(--line)] bg-[var(--forest)] p-5 shadow-2xl">
              {/* Window chrome */}
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-white/10" />
                    <span className="h-3 w-3 rounded-full bg-white/10" />
                    <span className="h-3 w-3 rounded-full bg-white/10" />
                  </div>
                  <span className="ml-3 text-xs font-medium text-white/60">
                    Dashboard — All Warehouses
                  </span>
                </div>
                <span className="flex items-center gap-1.5 text-xs text-[var(--sage)]">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                  Live
                </span>
              </div>

              {/* Metrics row */}
              <div className="mb-5 grid grid-cols-3 gap-3">
                {metrics.map((m, i) => (
                  <div
                    key={m.label}
                    className={`rounded-xl p-3 transition-all duration-500 ${
                      i === activeMetric ? "bg-white/10" : "bg-white/[0.04]"
                    }`}
                  >
                    <p className="text-[10px] font-medium text-white/40">{m.label}</p>
                    <p className="text-xl font-semibold text-white">{m.value}</p>
                    <p
                      className={`text-xs ${m.trend.startsWith("+") ? "text-emerald-400" : "text-red-400"}`}
                    >
                      {m.trend} vs last month
                    </p>
                  </div>
                ))}
              </div>

              {/* Warehouse list */}
              <div className="mb-5">
                <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-white/40">
                  Warehouse Status
                </p>
                <div className="space-y-2">
                  {warehouses.map((w) => (
                    <div
                      key={w.name}
                      className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                        w.status === "warning" ? "bg-amber-500/10" : "bg-emerald-500/10"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            w.status === "warning" ? "bg-amber-400" : "bg-emerald-400"
                          }`}
                        />
                        <span className="text-sm font-medium text-white">{w.name}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-white/50">{w.items} items</span>
                        <span className={w.capacity > 85 ? "text-amber-400" : "text-white/70"}>
                          {w.capacity}% full
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reorder alerts */}
              <div>
                <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-white/40">
                  Reorder Alerts
                </p>
                <div className="space-y-2">
                  {reorderAlerts.map((alert) => {
                    const config = severityConfig[alert.severity];
                    return (
                      <div
                        key={alert.sku}
                        className={`flex items-center justify-between rounded-lg px-3 py-2 ${config.bg}`}
                      >
                        <div>
                          <p className="text-sm font-medium text-white">{alert.name}</p>
                          <p className="text-[10px] text-white/40">{alert.sku}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
                          <span className={`text-xs ${config.color}`}>{alert.days} days left</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Footer */}
              <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
                <div>
                  <p className="text-[10px] text-white/40">Overall Health Score</p>
                  <p className="text-2xl font-semibold text-white">
                    96<span className="text-lg text-white/50">%</span>
                  </p>
                </div>
                <p className="text-xs text-white/40">Updated 2 min ago</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
