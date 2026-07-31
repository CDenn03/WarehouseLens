import type { ReactNode } from "react";
import Link from "next/link";
import { Badge } from "@/components/Badge";
import { Table } from "@/components/Table";
import type { Column } from "@/components/Table";
import { formatDateTime, formatNumber } from "@/lib/utils";
import { outboundStatusTone } from "@/features/outbound/types";
import type { OutboundStatus } from "@/features/outbound/types";
import type {
  AnalyticsAggregationData,
  ForecastData,
  InventoryQueryData,
  OutboundStatusData,
  ReportSynthesisData,
  SupplierPerformanceData,
} from "@/features/copilot/types";

type WarehouseMetric = NonNullable<AnalyticsAggregationData["by_warehouse"]>[number];

/**
 * Renders the structured `data` payload behind an assistant's prose answer —
 * see docs/agent-core-spec.md §5 for the exact shape each tool returns. The
 * prose is what the LLM chose to mention; this is the full result set it was
 * looking at, so an operator can verify or dig past what made it into words.
 *
 * Dispatches on which keys are present rather than on `toolUsed`, so a
 * report_synthesis section (whose `data` is one of these same shapes) renders
 * with the same code path as a top-level tool result.
 */
export function CopilotToolResult({ data }: { data: unknown }) {
  const node = renderPayload(data);
  if (!node) return null;
  return <div className="mt-3 w-full max-w-2xl">{node}</div>;
}

function renderPayload(data: unknown, depth = 0): ReactNode | null {
  if (!isRecord(data)) return null;

  if (isArrayOf(data.results, isRecord)) {
    return <InventoryTable results={(data as unknown as InventoryQueryData).results} />;
  }
  if (isArrayOf(data.suppliers, isRecord)) {
    return <SupplierTable suppliers={(data as unknown as SupplierPerformanceData).suppliers} />;
  }
  if (isRecord(data.forecast)) {
    return <ForecastSummary forecast={(data as unknown as ForecastData).forecast} />;
  }
  if (isArrayOf(data.requests, isRecord)) {
    return <OutboundTableCompact requests={(data as unknown as OutboundStatusData).requests} />;
  }
  if (isRecord(data.metrics)) {
    return <MetricsSummary payload={data as unknown as AnalyticsAggregationData} />;
  }
  if (isArrayOf(data.sections, isRecord) && depth < 3) {
    return (
      <div className="space-y-4">
        {(data as unknown as ReportSynthesisData).sections.map((section, index) => (
          <div key={`${section.title}-${index}`}>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-mute">
              {section.title}
            </p>
            {renderPayload(section.data, depth + 1)}
          </div>
        ))}
      </div>
    );
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isArrayOf<T>(
  value: unknown,
  guard: (item: unknown) => item is T,
): value is T[] {
  return Array.isArray(value) && (value.length === 0 || guard(value[0]));
}

function InventoryTable({ results }: { results: InventoryQueryData["results"] }) {
  const columns: Column<InventoryQueryData["results"][number]>[] = [
    { key: "sku", header: "SKU", render: (r) => <span className="font-medium">{r.sku}</span> },
    { key: "name", header: "Product", render: (r) => r.name },
    { key: "warehouse", header: "Warehouse", render: (r) => r.warehouse_name },
    {
      key: "on_hand",
      header: "On hand",
      className: "text-right tabular-nums",
      render: (r) => formatNumber(r.quantity_on_hand),
    },
    {
      key: "reserved",
      header: "Reserved",
      className: "text-right tabular-nums",
      render: (r) => formatNumber(r.quantity_reserved),
    },
    {
      key: "reorder_point",
      header: "Reorder pt.",
      className: "text-right tabular-nums",
      render: (r) => formatNumber(r.reorder_point),
    },
  ];
  return (
    <div className="overflow-hidden rounded-lg border border-brand-100">
      <Table
        columns={columns}
        rows={results}
        rowKey={(r) => `${r.warehouse_id}-${r.sku}`}
        rowClassName={(r) => (r.quantity_on_hand < r.reorder_point ? "bg-warning-light/40" : undefined)}
        emptyMessage="No matching stock found."
      />
    </div>
  );
}

function SupplierTable({ suppliers }: { suppliers: SupplierPerformanceData["suppliers"] }) {
  const columns: Column<SupplierPerformanceData["suppliers"][number]>[] = [
    { key: "name", header: "Supplier", render: (s) => <span className="font-medium">{s.name}</span> },
    { key: "po_count", header: "POs", className: "text-right tabular-nums", render: (s) => formatNumber(s.po_count) },
    {
      key: "lead_time",
      header: "Avg lead time",
      className: "text-right tabular-nums",
      render: (s) => `${formatNumber(s.avg_lead_time_days)}d (promised ${formatNumber(s.promised_lead_time_days)}d)`,
    },
    {
      key: "on_time",
      header: "On-time rate",
      className: "text-right tabular-nums",
      render: (s) => `${formatNumber(s.on_time_rate_percent)}%`,
    },
    {
      key: "delay",
      header: "Avg delay",
      className: "text-right tabular-nums",
      render: (s) => `${formatNumber(s.avg_delay_days)}d`,
    },
    { key: "late", header: "Late POs", className: "text-right tabular-nums", render: (s) => formatNumber(s.late_po_count) },
  ];
  return (
    <div className="overflow-hidden rounded-lg border border-brand-100">
      <Table columns={columns} rows={suppliers} rowKey={(s) => s.name} emptyMessage="No supplier activity found." />
    </div>
  );
}

function OutboundTableCompact({ requests }: { requests: OutboundStatusData["requests"] }) {
  const columns: Column<OutboundStatusData["requests"][number]>[] = [
    {
      key: "id",
      header: "Request",
      render: (r) => (
        <Link href={`/outbound/${r.id}`} className="font-medium text-brand-900 hover:underline">
          #{r.id.slice(0, 8)}
        </Link>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (r) => (r.is_internal_transfer ? <Badge tone="blue">Internal transfer</Badge> : <Badge tone="brand">Sales order</Badge>),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <Badge tone={outboundStatusTone(r.status as OutboundStatus)}>{r.status}</Badge>,
    },
    { key: "items", header: "Items", className: "text-right tabular-nums", render: (r) => formatNumber(r.item_count) },
    { key: "created_at", header: "Created", render: (r) => formatDateTime(r.created_at) },
    {
      key: "shipment",
      header: "Shipment",
      render: (r) => (r.carrier ? `${r.carrier} · ${r.tracking_number ?? "—"}` : "—"),
    },
  ];
  return (
    <div className="overflow-hidden rounded-lg border border-brand-100">
      <Table columns={columns} rows={requests} rowKey={(r) => r.id} emptyMessage="No outbound requests found." />
    </div>
  );
}

const METRIC_LABELS: Record<string, string> = {
  total_inventory_value: "Total inventory value",
  skus_below_reorder_point: "SKUs below reorder point",
  open_outbound_requests: "Open outbound requests",
};

function formatMetricLabel(key: string): string {
  return METRIC_LABELS[key] ?? key.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
}

function formatMetricValue(key: string, value: number): string {
  if (/value|cost|price/.test(key)) return `$${formatNumber(value)}`;
  return formatNumber(value);
}

function MetricsSummary({ payload }: { payload: AnalyticsAggregationData }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {Object.entries(payload.metrics).map(([key, value]) => (
          <div key={key} className="rounded-lg border border-brand-100 bg-surface-panel px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-ink-mute">{formatMetricLabel(key)}</p>
            <p className="text-lg font-semibold tabular-nums text-brand-900">{formatMetricValue(key, value)}</p>
          </div>
        ))}
      </div>
      {payload.by_warehouse && payload.by_warehouse.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-brand-100">
          <Table
            columns={[
              { key: "warehouse", header: "Warehouse", render: (w) => w.warehouse_name },
              ...Object.keys(payload.by_warehouse[0].metrics).map(
                (metricKey): Column<WarehouseMetric> => ({
                  key: metricKey,
                  header: formatMetricLabel(metricKey),
                  className: "text-right tabular-nums",
                  render: (w) => formatMetricValue(metricKey, w.metrics[metricKey]),
                }),
              ),
            ]}
            rows={payload.by_warehouse}
            rowKey={(w) => w.warehouse_id}
          />
        </div>
      )}
    </div>
  );
}

function ForecastSummary({ forecast }: { forecast: ForecastData["forecast"] }) {
  const tiles: Array<[string, string]> = [
    ["SKU", forecast.sku],
    ["Horizon", `${forecast.horizon_days} days`],
    ["Model", forecast.model],
    ["Total projected demand", formatNumber(forecast.total_projected_demand)],
    ["Peak day", `${forecast.peak_day} (${formatNumber(forecast.peak_day_demand)} units)`],
    [
      "Confidence band",
      `${formatNumber(forecast.confidence_low)} – ${formatNumber(forecast.confidence_high)} units`,
    ],
  ];
  return (
    <div className="flex flex-wrap gap-3">
      {tiles.map(([label, value]) => (
        <div key={label} className="rounded-lg border border-brand-100 bg-surface-panel px-3 py-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-mute">{label}</p>
          <p className="text-sm font-semibold tabular-nums text-brand-900">{value}</p>
        </div>
      ))}
    </div>
  );
}
