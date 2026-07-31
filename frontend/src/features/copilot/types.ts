/** Copilot (AI agent chat) feature types. */

/** POST /agent/query response. */
export interface AgentQueryResponse {
  answer: string;
  tool_used: string | null;
  data: unknown;
}

export type AskCopilotResult =
  | { ok: true; answer: string; toolUsed: string | null; data: unknown }
  | { ok: false; error: string };

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Name of the backend tool the agent used, shown as a badge. */
  toolUsed?: string | null;
  /** Structured payload behind the prose answer — see agent-core-spec.md §5. */
  data?: unknown;
  /** True when the assistant bubble represents a failed request. */
  isError?: boolean;
}

// Structured shapes tool_result payloads take, per docs/agent-core-spec.md §5.
// Field names match the spec exactly (they're what the synthesize node reads).

export interface InventoryQueryData {
  results: Array<{
    sku: string;
    name: string;
    warehouse_id: string;
    warehouse_name: string;
    quantity_on_hand: number;
    quantity_reserved: number;
    reorder_point: number;
  }>;
}

export interface SupplierPerformanceData {
  suppliers: Array<{
    name: string;
    po_count: number;
    avg_lead_time_days: number;
    promised_lead_time_days: number;
    on_time_rate_percent: number;
    avg_delay_days: number;
    late_po_count: number;
  }>;
}

export interface ForecastData {
  forecast: {
    sku: string;
    warehouse_id: string;
    horizon_days: number;
    model: string;
    total_projected_demand: number;
    peak_day: string;
    peak_day_demand: number;
    confidence_low: number;
    confidence_high: number;
  };
}

export interface AnalyticsAggregationData {
  warehouse_id?: string | null;
  metrics: Record<string, number>;
  by_warehouse?: Array<{
    warehouse_id: string;
    warehouse_name: string;
    metrics: Record<string, number>;
  }>;
}

export interface OutboundStatusData {
  requests: Array<{
    id: string;
    status: string;
    is_internal_transfer: boolean;
    item_count: number;
    created_at: string;
    carrier: string | null;
    tracking_number: string | null;
    pick_list_items?: Array<{
      sku: string;
      quantity_requested: number;
      quantity_picked: number;
      location: string | null;
    }>;
  }>;
}

export interface ReportSynthesisData {
  sections: Array<{ title: string; data: unknown }>;
}
