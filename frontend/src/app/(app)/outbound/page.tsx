import type { Metadata } from "next";
import { OutboundPage } from "@/features/outbound/components/OutboundPage";
import type { OutboundStatus } from "@/features/outbound/types";

export const metadata: Metadata = { title: "Outbound" };
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ status?: OutboundStatus; warehouse_id?: string }>;
}) {
  const { status, warehouse_id } = await searchParams;
  return (
    <OutboundPage
      status={status}
      warehouseId={warehouse_id}
    />
  );
}
