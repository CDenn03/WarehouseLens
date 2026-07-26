"use client";

import { Search, X } from "lucide-react";

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
  className,
}: SearchInputProps) {
  return (
    <div className={className}>
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
          style={{ color: "var(--ink-mute)" }}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border py-2 pl-9 pr-9 text-sm transition-colors placeholder:text-ink-mute focus:border-brand-300 focus:outline-none focus:ring-1 focus:ring-brand-300"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface-panel)",
            color: "var(--ink)",
          }}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 transition-colors hover:bg-brand-50"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" style={{ color: "var(--ink-mute)" }} />
          </button>
        )}
      </div>
    </div>
  );
}
