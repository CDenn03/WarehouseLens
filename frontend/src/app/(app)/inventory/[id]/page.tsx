import type { Metadata } from "next";
import { ProductDetailPage } from "@/features/inventory/components/ProductDetailPage";

export const metadata: Metadata = { title: "Product detail" };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductDetailPage productId={id} />;
}
