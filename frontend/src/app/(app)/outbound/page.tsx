import type { Metadata } from "next";
import { OutboundPage } from "@/features/outbound/components/OutboundPage";
import type { OutboundStatus } from "@/features/outbound/types";

export const metadata: Metadata = { title: "Outbound" };
export const dynamic = "force-dynamic";

export default function Page({
  searchParams,
}: {
  searchParams: { status?: OutboundStatus; warehouse_id?: string };
}) {
  return (
    <OutboundPage
      status={searchParams.status}
      warehouseId={searchParams.warehouse_id}
    />
  );
}
