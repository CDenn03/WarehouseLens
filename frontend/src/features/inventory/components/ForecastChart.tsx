"use client";

import {
  Area,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatNumber, formatShortDate } from "@/lib/utils";
import type { ForecastPoint } from "@/features/inventory/types";

interface ChartPoint {
  date: string;
  yhat: number;
  /** [lower, upper] — Recharts renders array dataKeys as a range area. */
  band: [number, number];
}

export function ForecastChart({ points }: { points: ForecastPoint[] }) {
  const data: ChartPoint[] = points.map((p) => ({
    date: p.date,
    yhat: p.yhat,
    band: [p.yhat_lower, p.yhat_upper],
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="date"
            tickFormatter={formatShortDate}
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickLine={false}
            axisLine={{ stroke: "#e2e8f0" }}
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(value: number) => formatNumber(value)}
          />
          <Tooltip
            labelFormatter={(label) => formatShortDate(String(label))}
            formatter={(value: number | [number, number], name: string) => {
              if (Array.isArray(value)) {
                return [
                  `${formatNumber(value[0])} – ${formatNumber(value[1])}`,
                  "Confidence band",
                ];
              }
              return [formatNumber(value), name === "yhat" ? "Forecast" : name];
            }}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey="band"
            stroke="none"
            fill="#c7d2fe"
            fillOpacity={0.6}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="yhat"
            stroke="#4f46e5"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
