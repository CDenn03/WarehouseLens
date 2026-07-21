import { apiFetch } from "@/lib/api";
import type { AgentQueryResponse } from "@/features/copilot/types";

export function queryAgent(
  question: string,
  warehouseId: string | null,
): Promise<AgentQueryResponse> {
  return apiFetch<AgentQueryResponse>("/agent/query", {
    method: "POST",
    body: { question, warehouse_id: warehouseId },
  });
}
