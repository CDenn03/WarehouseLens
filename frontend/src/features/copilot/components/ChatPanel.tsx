"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Input";
import { cn } from "@/lib/utils";
import type { Warehouse } from "@/features/inventory/types";
import { askCopilot } from "@/features/copilot/actions/copilotActions";
import type { ChatMessage } from "@/features/copilot/types";

const suggestions = [
  "Which SKUs are below their reorder point?",
  "What is the total inventory value right now?",
  "Show me open outbound requests.",
  "Forecast demand for our top product over the next 30 days.",
];

let messageCounter = 0;
function nextId(): string {
  messageCounter += 1;
  return `msg-${messageCounter}`;
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm",
          isUser
            ? "rounded-br-sm bg-brand-900 text-ink-on-brand"
            : message.isError
              ? "rounded-bl-sm border border-error-border bg-error-light text-error"
              : "rounded-bl-sm border border-brand-100 bg-surface-panel text-ink",
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        {!isUser && message.toolUsed && (
          <div className="mt-2">
            <Badge tone="brand" className="normal-case">
              tool: {message.toolUsed}
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
}

export function ChatPanel({ warehouses }: { warehouses: Warehouse[] }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [isPending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isPending]);

  const send = (raw: string) => {
    const question = raw.trim();
    if (!question || isPending) return;

    setMessages((current) => [
      ...current,
      { id: nextId(), role: "user", content: question },
    ]);
    setInput("");

    startTransition(async () => {
      const result = await askCopilot(question, warehouseId || null);
      setMessages((current) => [
        ...current,
        result.ok
          ? {
              id: nextId(),
              role: "assistant",
              content: result.answer,
              toolUsed: result.toolUsed,
            }
          : {
              id: nextId(),
              role: "assistant",
              content: result.error,
              isError: true,
            },
      ]);
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-brand-100 bg-surface-panel shadow-sm">
      {/* Scope selector */}
      <div className="flex items-center justify-between gap-4 border-b border-brand-100 px-4 py-3">
        <p className="text-sm font-medium text-ink-soft">Conversation scope</p>
        <div className="w-56">
          <Select
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            placeholder="All warehouses"
            options={warehouses.map((w) => ({
              value: String(w.id),
              label: w.name,
            }))}
            aria-label="Warehouse scope"
          />
        </div>
      </div>

      {/* Message list */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto bg-brand-50/60 p-4"
        style={{ minHeight: "20rem" }}
      >
        {messages.length === 0 && !isPending ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 py-8 text-center">
            <p className="text-sm text-ink-mute">
              Ask anything about your warehouse operations. Try one of these:
            </p>
            <div className="flex max-w-lg flex-wrap justify-center gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => send(suggestion)}
                  className="rounded-full border border-brand-100 bg-surface-panel px-3 py-1.5 text-xs text-ink-soft shadow-sm transition-colors hover:border-brand-300 hover:text-brand-900"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))
        )}
        {isPending && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-brand-100 bg-surface-panel px-4 py-3 shadow-sm">
              <span className="h-2 w-2 animate-bounce rounded-full bg-ink-mute [animation-delay:-0.3s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-ink-mute [animation-delay:-0.15s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-ink-mute" />
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <form
        className="flex items-end gap-2 border-t border-brand-100 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          send(input);
        }}
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send(input);
            }
          }}
          rows={2}
          placeholder="e.g. Which warehouse is running low on WL-1042?"
          aria-label="Message the copilot"
          className="flex-1"
        />
        <Button type="submit" isLoading={isPending} disabled={!input.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
}
