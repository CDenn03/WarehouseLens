"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipProps } from "recharts";
import { formatCurrency, formatPercent } from "@/lib/utils";
import type { AbcClass, AbcRankingRow } from "@/features/dashboard/types";

const classColors: Record<AbcClass, string> = {
  A: "var(--green-900)",
  B: "var(--green-600)",
  C: "var(--green-100)",
};

function AbcTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload as AbcRankingRow;
  return (
    <div className="rounded-lg border border-brand-100 bg-surface-panel px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-ink">
        {row.sku} — {row.name}
      </p>
      <p className="mt-1 text-ink-soft">
        Value: {formatCurrency(row.inventory_value)}
      </p>
      <p className="text-ink-soft">
        Cumulative share: {formatPercent(row.cumulative_share)}
      </p>
      <p className="text-ink-soft">Class: {row.abc_class}</p>
    </div>
  );
}

export function AbcRankingChart({ data }: { data: AbcRankingRow[] }) {
  if (data.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-ink-mute">
        No inventory value data to rank yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--green-100)" vertical={false} />
            <XAxis
              dataKey="sku"
              tick={{ fontSize: 10, fill: "var(--ink-mute)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--green-100)" }}
              interval={0}
              angle={-35}
              textAnchor="end"
              height={56}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--ink-mute)" }}
              tickLine={false}
              axisLine={false}
              width={72}
              tickFormatter={(value: number) => formatCurrency(value)}
            />
            <Tooltip content={<AbcTooltip />} cursor={{ fill: "var(--green-050)" }} />
            <Bar dataKey="inventory_value" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {data.map((row) => (
                <Cell key={row.sku} fill={classColors[row.abc_class] ?? "var(--green-100)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-center gap-4 text-xs text-ink-mute">
        {(Object.keys(classColors) as AbcClass[]).map((abcClass) => (
          <span key={abcClass} className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: classColors[abcClass] }}
            />
            Class {abcClass}
          </span>
        ))}
      </div>
    </div>
  );
}
