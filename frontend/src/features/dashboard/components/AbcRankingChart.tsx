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
  A: "#4f46e5", // indigo-600
  B: "#818cf8", // indigo-400
  C: "#cbd5e1", // slate-300
};

function AbcTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload as AbcRankingRow;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-slate-900">
        {row.sku} — {row.name}
      </p>
      <p className="mt-1 text-slate-600">
        Value: {formatCurrency(row.inventory_value)}
      </p>
      <p className="text-slate-600">
        Cumulative share: {formatPercent(row.cumulative_share)}
      </p>
      <p className="text-slate-600">Class: {row.abc_class}</p>
    </div>
  );
}

export function AbcRankingChart({ data }: { data: AbcRankingRow[] }) {
  if (data.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-slate-400">
        No inventory value data to rank yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="sku"
              tick={{ fontSize: 10, fill: "#64748b" }}
              tickLine={false}
              axisLine={{ stroke: "#e2e8f0" }}
              interval={0}
              angle={-35}
              textAnchor="end"
              height={56}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#64748b" }}
              tickLine={false}
              axisLine={false}
              width={72}
              tickFormatter={(value: number) => formatCurrency(value)}
            />
            <Tooltip content={<AbcTooltip />} cursor={{ fill: "#f1f5f9" }} />
            <Bar dataKey="inventory_value" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {data.map((row) => (
                <Cell key={row.sku} fill={classColors[row.abc_class] ?? "#cbd5e1"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-center gap-4 text-xs text-slate-500">
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
