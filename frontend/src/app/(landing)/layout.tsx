import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "WarehouseLens — warehouse operations, unified",
  description:
    "Multi-warehouse inventory, procurement, and the pick-pack-ship workflow, forecasted per site and explained in plain language by an AI copilot that can't wander off-script.",
};

/**
 * Landing segment layout — no Sidebar, no app header.
 * The LandingPage component provides its own header and footer.
 */
export default function LandingLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
