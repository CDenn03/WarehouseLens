import type { Metadata } from "next";
import { CopilotPage } from "@/features/copilot/components/CopilotPage";

export const metadata: Metadata = { title: "Copilot" };
export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ q?: string }>;
};

export default async function Page({ searchParams }: Props) {
  const { q } = await searchParams;
  return <CopilotPage initialQuestion={q} />;
}
