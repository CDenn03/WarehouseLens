import type { Metadata } from "next";
import { ProcurementPage } from "@/features/procurement/components/ProcurementPage";
import type { PurchaseOrderStatus } from "@/features/procurement/types";

export const metadata: Metadata = { title: "Procurement" };
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ status?: PurchaseOrderStatus; warehouse_id?: string }>;
}) {
  const { status, warehouse_id } = await searchParams;
  return (
    <ProcurementPage
      status={status}
      warehouseId={warehouse_id}
    />
  );
}
