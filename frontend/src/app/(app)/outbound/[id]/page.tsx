import type { Metadata } from "next";
import { OutboundDetailPage } from "@/features/outbound/components/OutboundDetailPage";

export const metadata: Metadata = { title: "Outbound request" };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OutboundDetailPage requestId={id} />;
}
