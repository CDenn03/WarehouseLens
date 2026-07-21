"use server";

import { queryAgent } from "@/features/copilot/services/copilotService";
import type { AskCopilotResult } from "@/features/copilot/types";
import { getErrorMessage } from "@/lib/utils";

export async function askCopilot(
  question: string,
  warehouseId: string | null,
): Promise<AskCopilotResult> {
  const trimmed = question.trim();
  if (!trimmed) {
    return { ok: false, error: "Ask a question first." };
  }
  try {
    const response = await queryAgent(trimmed, warehouseId);
    return {
      ok: true,
      answer: response.answer,
      toolUsed: response.tool_used,
    };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}
