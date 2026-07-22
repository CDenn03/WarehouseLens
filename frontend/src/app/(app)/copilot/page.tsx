import type { Metadata } from "next";
import { CopilotPage } from "@/features/copilot/components/CopilotPage";

export const metadata: Metadata = { title: "Copilot" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <CopilotPage />;
}
