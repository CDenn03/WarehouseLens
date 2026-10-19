import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "WarehouseLens — every warehouse, one clear view",
  description: "Coordinate inventory, procurement, fulfillment, demand and risk across warehouse locations with structured visibility and grounded decisions.",
};

export default function LandingLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
