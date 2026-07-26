import { apiFetch } from "@/lib/api";
import type { TenantDashboardSummary } from "@/features/admin/types";

export function getTenantSummary(): Promise<TenantDashboardSummary> {
  return apiFetch<TenantDashboardSummary>("/dashboard/tenant");
}
