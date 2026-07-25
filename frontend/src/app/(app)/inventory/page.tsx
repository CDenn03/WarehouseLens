import type { Metadata } from "next";
import { InventoryPage } from "@/features/inventory/components/InventoryPage";

export const metadata: Metadata = { title: "Inventory" };
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const { search } = await searchParams;
  return <InventoryPage search={search} />;
}
