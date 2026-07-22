import type { Metadata } from "next";
import { ProductDetailPage } from "@/features/inventory/components/ProductDetailPage";

export const metadata: Metadata = { title: "Product detail" };
export const dynamic = "force-dynamic";

export default function Page({ params }: { params: { id: string } }) {
  return <ProductDetailPage productId={params.id} />;
}
