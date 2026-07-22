import type { Metadata } from "next";
import { InventoryPage } from "@/features/inventory/components/InventoryPage";

export const metadata: Metadata = { title: "Inventory" };
export const dynamic = "force-dynamic";

export default function Page({
  searchParams,
}: {
  searchParams: { search?: string };
}) {
  return <InventoryPage search={searchParams.search} />;
}
