import type { Metadata } from "next";
import { OutboundDetailPage } from "@/features/outbound/components/OutboundDetailPage";

export const metadata: Metadata = { title: "Outbound request" };
export const dynamic = "force-dynamic";

export default function Page({ params }: { params: { id: string } }) {
  return <OutboundDetailPage requestId={params.id} />;
}
