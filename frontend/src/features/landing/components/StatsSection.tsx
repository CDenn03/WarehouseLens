"use client";

import { useEffect, useRef, useState } from "react";

const stats = [
  {
    value: 99.2,
    suffix: "%",
    label: "Inventory accuracy",
    desc: "Real-time stock tracking across all sites",
  },
  {
    value: 67,
    suffix: "%",
    label: "Fewer stockouts",
    desc: "With AI-powered reorder predictions",
  },
  {
    value: 14,
    suffix: "-day",
    label: "Demand forecast",
    desc: "Prophet + XGBoost, benchmarked",
  },
  {
    value: 5,
    suffix: " min",
    label: "Setup time",
    desc: "Sandbox ready before your coffee cools",
  },
];

function AnimatedCounter({
  value,
  suffix,
  isVisible,
}: {
  value: number;
  suffix: string;
  isVisible: boolean;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isVisible) return;

    const duration = 1500;
    const steps = 60;
    const increment = value / steps;
    let current = 0;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      current = Math.min(value, increment * step);
      setCount(current);

      if (step >= steps) {
        clearInterval(timer);
        setCount(value);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [isVisible, value]);

  const displayValue = Number.isInteger(value) ? Math.round(count) : count.toFixed(1);

  return (
    <span>
      {displayValue}
      {suffix}
    </span>
  );
}

export function StatsSection() {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section ref={ref} className="relative overflow-hidden border-y border-[var(--line)] bg-[var(--forest)]">
      {/* Decorative gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-[var(--forest)] via-[var(--forest-soft)] to-[var(--forest)]" />

      <div className="relative mx-auto max-w-[var(--maxw)] px-6 py-16 lg:px-10 lg:py-20">
        <div className="mb-10 text-center">
          <p className="mb-3 font-mono text-xs tracking-wide text-[var(--sage)]">/by the numbers</p>
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--ink-on-brand)] sm:text-3xl">
            Built for warehouses that outgrew the spreadsheet
          </h2>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className="group text-center"
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? "translateY(0)" : "translateY(20px)",
                transition: `all 0.6s ease-out ${i * 0.1}s`,
              }}
            >
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.06] transition group-hover:bg-white/10">
                <span className="text-3xl font-bold text-[var(--sage)]">
                  <AnimatedCounter value={stat.value} suffix={stat.suffix} isVisible={isVisible} />
                </span>
              </div>
              <p className="mb-1 text-lg font-semibold text-[var(--ink-on-brand)]">{stat.label}</p>
              <p className="text-sm text-white/50">{stat.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
