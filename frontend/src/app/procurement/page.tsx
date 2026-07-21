import type { Metadata } from "next";
import { ProcurementPage } from "@/features/procurement/components/ProcurementPage";
import type { PurchaseOrderStatus } from "@/features/procurement/types";

export const metadata: Metadata = { title: "Procurement" };
export const dynamic = "force-dynamic";

export default function Page({
  searchParams,
}: {
  searchParams: { status?: PurchaseOrderStatus; warehouse_id?: string };
}) {
  return (
    <ProcurementPage
      status={searchParams.status}
      warehouseId={searchParams.warehouse_id}
    />
  );
}
