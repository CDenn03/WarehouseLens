"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import type { RoleRead } from "@/features/admin/types";

interface Props {
  value: string | null;
  onChange: (slug: string) => void;
  roles: RoleRead[];
  label?: string;
  required?: boolean;
  placeholder?: string;
}

const EXCLUDED_SLUGS = new Set(["platform_admin"]);

export function RoleCombobox({
  value,
  onChange,
  roles,
  label = "Role",
  required = false,
  placeholder = "Search roles...",
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectable = useMemo(
    () => roles.filter((r) => !EXCLUDED_SLUGS.has(r.slug)),
    [roles],
  );

  const selected = useMemo(
    () => selectable.find((r) => r.slug === value) ?? null,
    [selectable, value],
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return selectable;
    const q = search.toLowerCase();
    return selectable.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.slug.toLowerCase().includes(q),
    );
  }, [selectable, search]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(slug: string) {
    onChange(slug);
    setOpen(false);
    setSearch("");
  }

  function handleClear() {
    onChange("");
    setSearch("");
    inputRef.current?.focus();
  }

  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium" style={{ color: "var(--ink-soft)" }}>
        {label} {required && <span style={{ color: "var(--error)" }}>*</span>}
      </label>
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => { setOpen(!open); inputRef.current?.focus(); }}
          className="flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-1.5 text-sm text-left transition-colors"
          style={{
            borderColor: open ? "var(--green-900)" : "var(--border)",
            background: "var(--surface-panel)",
            color: selected ? "var(--ink)" : "var(--ink-mute)",
          }}
        >
          <span className="truncate">{selected ? selected.name : "Select a role..."}</span>
          <div className="flex shrink-0 items-center gap-1">
            {selected && (
              <span
                onClick={(e) => { e.stopPropagation(); handleClear(); }}
                className="cursor-pointer rounded p-0.5 transition-colors hover:bg-brand-50"
              >
                <X className="h-3.5 w-3.5" style={{ color: "var(--ink-mute)" }} />
              </span>
            )}
            <ChevronDown
              className="h-4 w-4 transition-transform"
              style={{
                color: "var(--ink-mute)",
                transform: open ? "rotate(180deg)" : undefined,
              }}
            />
          </div>
        </button>

        {open && (
          <div
            className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border shadow-lg"
            style={{
              borderColor: "var(--border-soft)",
              background: "var(--green-050)",
            }}
          >
            <div className="flex items-center gap-2 border-b px-3 py-2" style={{ borderColor: "var(--border-soft)" }}>
              <Search className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--ink-mute)" }} />
              <input
                ref={inputRef}
                type="text"
                placeholder={placeholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--ink-mute)]"
                style={{ color: "var(--ink)" }}
                autoFocus
              />
            </div>
            <ul className="max-h-48 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-xs" style={{ color: "var(--ink-mute)" }}>
                  No roles found.
                </li>
              ) : (
                filtered.map((role) => (
                  <li key={role.slug}>
                    <button
                      type="button"
                      onClick={() => handleSelect(role.slug)}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-brand-50"
                      style={{
                        color: role.slug === value ? "var(--green-900)" : "var(--ink)",
                        fontWeight: role.slug === value ? 600 : 400,
                      }}
                    >
                      <span className="truncate">{role.name}</span>
                      <span
                        className="ml-auto shrink-0 text-xs"
                        style={{ color: "var(--ink-mute)" }}
                      >
                        {role.slug}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
