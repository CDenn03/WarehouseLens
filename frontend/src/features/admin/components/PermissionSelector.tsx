"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { listPermissions } from "@/features/admin/services/adminService";
import type { PermissionRead } from "@/features/admin/types";

interface Props {
  value: string[];
  onChange: (ids: string[]) => void;
  pageSize?: number;
}

const PAGE_SIZE_DEFAULT = 10;

const CATEGORY_LABELS: Record<string, string> = {
  agent: "Agent",
  dashboard: "Dashboard",
  forecast: "Forecast",
  iam: "IAM",
  inventory: "Inventory",
  outbound: "Outbound",
  platform: "Platform",
  procurement: "Procurement",
  warehouse: "Warehouse",
};

export function PermissionSelector({ value, onChange, pageSize = PAGE_SIZE_DEFAULT }: Props) {
  const [allPerms, setAllPerms] = useState<PermissionRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    listPermissions()
      .then(setAllPerms)
      .finally(() => setLoading(false));
  }, []);

  const selected = useMemo(() => new Set(value), [value]);

  const filtered = useMemo(() => {
    if (!search.trim()) return allPerms;
    const q = search.toLowerCase();
    return allPerms.filter(
      (p) =>
        p.id.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        (CATEGORY_LABELS[p.category] ?? p.category).toLowerCase().includes(q),
    );
  }, [allPerms, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const rows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const pageIds = rows.map((r) => r.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const somePageSelected = pageIds.some((id) => selected.has(id));

  const filteredIds = useMemo(() => filtered.map((p) => p.id), [filtered]);
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));

  function togglePage() {
    if (allPageSelected) {
      onChange(value.filter((id) => !pageIds.includes(id)));
    } else {
      const merged = new Set(value);
      pageIds.forEach((id) => merged.add(id));
      onChange(Array.from(merged));
    }
  }

  function toggleAllFiltered() {
    if (allFilteredSelected) {
      onChange(value.filter((id) => !filteredIds.includes(id)));
    } else {
      const merged = new Set(value);
      filteredIds.forEach((id) => merged.add(id));
      onChange(Array.from(merged));
    }
  }

  function toggleOne(id: string) {
    if (selected.has(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  }

  if (loading) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border py-8 text-sm"
        style={{ borderColor: "var(--border-soft)", color: "var(--ink-mute)" }}
      >
        Loading permissions...
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium" style={{ color: "var(--ink-soft)" }}>
        Permissions
      </label>

      <div className="relative">
        <Search
          className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
          style={{ color: "var(--ink-mute)" }}
        />
        <input
          type="text"
          placeholder="Search permissions..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full rounded-lg border py-1.5 pl-8 pr-3 text-sm focus:border-brand-300 focus:outline-none focus:ring-1 focus:ring-brand-300"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface-panel)",
            color: "var(--ink)",
          }}
        />
      </div>

      <div className="flex items-center justify-between text-xs" style={{ color: "var(--ink-mute)" }}>
        <span>
          {selected.size} selected
          {filtered.length !== allPerms.length && ` of ${filtered.length} shown`}
          {` (${allPerms.length} total)`}
        </span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={togglePage}
            className="underline transition-colors hover:opacity-80"
            style={{ color: "var(--green-900)" }}
          >
            {allPageSelected ? "Deselect page" : "Select page"}
          </button>
          <button
            type="button"
            onClick={toggleAllFiltered}
            className="underline transition-colors hover:opacity-80"
            style={{ color: "var(--green-900)" }}
          >
            {allFilteredSelected ? "Deselect all" : "Select all"}
          </button>
        </div>
      </div>

      <div
        className="overflow-hidden rounded-lg border"
        style={{ borderColor: "var(--border-soft)" }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--green-050)" }}>
              <th className="w-10 px-3 py-2 text-left">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  ref={(el) => { if (el) el.indeterminate = somePageSelected && !allPageSelected; }}
                  onChange={togglePage}
                  className="h-3.5 w-3.5 accent-current"
                  style={{ accentColor: "var(--green-900)" }}
                />
              </th>
              <th className="px-3 py-2 text-left font-medium" style={{ color: "var(--green-900)" }}>
                Permission
              </th>
              <th className="px-3 py-2 text-left font-medium" style={{ color: "var(--green-900)" }}>
                Description
              </th>
              <th className="px-3 py-2 text-left font-medium" style={{ color: "var(--green-900)" }}>
                Category
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-6 text-center text-xs"
                  style={{ color: "var(--ink-mute)" }}
                >
                  {search ? `No permissions match "${search}".` : "No permissions found."}
                </td>
              </tr>
            )}
            {rows.map((p, i) => (
              <tr
                key={p.id}
                onClick={() => toggleOne(p.id)}
                className="cursor-pointer transition-colors"
                style={{
                  background: i % 2 === 0 ? "var(--surface-panel)" : "var(--bg-alt)",
                }}
              >
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={() => toggleOne(p.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-3.5 w-3.5 accent-current"
                    style={{ accentColor: "var(--green-900)" }}
                  />
                </td>
                <td className="px-3 py-2 font-mono text-xs" style={{ color: "var(--ink)" }}>
                  {p.id}
                </td>
                <td className="px-3 py-2" style={{ color: "var(--ink-soft)" }}>
                  {p.description}
                </td>
                <td className="px-3 py-2">
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-medium capitalize"
                    style={{ background: "var(--green-050)", color: "var(--green-900)" }}
                  >
                    {CATEGORY_LABELS[p.category] ?? p.category}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            className="rounded p-1 transition-colors hover:bg-brand-50 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronLeft className="h-4 w-4" style={{ color: "var(--ink-soft)" }} />
          </button>
          <span className="px-2 text-xs" style={{ color: "var(--ink-mute)" }}>
            {safePage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className="rounded p-1 transition-colors hover:bg-brand-50 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronRight className="h-4 w-4" style={{ color: "var(--ink-soft)" }} />
          </button>
        </div>
      )}
    </div>
  );
}
