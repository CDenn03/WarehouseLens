/** Copilot (AI agent chat) feature types. */

/** POST /agent/query response. */
export interface AgentQueryResponse {
  answer: string;
  tool_used: string | null;
  data: unknown;
}

export type AskCopilotResult =
  | { ok: true; answer: string; toolUsed: string | null }
  | { ok: false; error: string };

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Name of the backend tool the agent used, shown as a badge. */
  toolUsed?: string | null;
  /** True when the assistant bubble represents a failed request. */
  isError?: boolean;
}
