"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/api";

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface UseTableDataOptions {
  pageSize?: number;
  defaultSortBy?: string;
  defaultSortOrder?: "asc" | "desc";
  searchDebounceMs?: number;
}

export interface UseTableDataResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  isLoading: boolean;
  error: string | null;
  search: string;
  setSearch: (value: string) => void;
  filters: Record<string, string>;
  setFilter: (key: string, value: string) => void;
  clearFilters: () => void;
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  refresh: () => void;
}

export function useTableData<T>(
  endpoint: string,
  options: UseTableDataOptions = {},
): UseTableDataResult<T> {
  const {
    pageSize = 20,
    defaultSortBy,
    defaultSortOrder = "desc",
    searchDebounceMs = 500,
  } = options;

  const [data, setData] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sortBy] = useState(defaultSortBy);
  const [sortOrder] = useState(defaultSortOrder);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, searchDebounceMs);
    return () => clearTimeout(timer);
  }, [search, searchDebounceMs]);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    let cancelled = false;
    async function fetchData() {
      setIsLoading(true);
      setError(null);
      try {
        const query: Record<string, string | number> = {
          page,
          page_size: pageSize,
        };
        if (debouncedSearch) query.search = debouncedSearch;
        if (sortBy) query.sort_by = sortBy;
        if (sortOrder) query.sort_order = sortOrder;
        for (const [key, value] of Object.entries(filters)) {
          if (value) query[key] = value;
        }

        const result = await apiFetch<PaginatedResponse<T>>(endpoint, {
          query,
        });
        if (!cancelled) {
          setData(result.items);
          setTotal(result.total);
          setTotalPages(result.total_pages);
        }
      } catch (err: unknown) {
        if (!cancelled && !(err instanceof DOMException && err.name === "AbortError")) {
          setError(err instanceof Error ? err.message : "Failed to fetch data");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    fetchData();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [endpoint, page, pageSize, debouncedSearch, sortBy, sortOrder, filters, refreshKey]);

  const setFilter = useCallback((key: string, value: string) => {
    setFilters((prev) => {
      const next = { ...prev };
      if (value) {
        next[key] = value;
      } else {
        delete next[key];
      }
      return next;
    });
    setPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
    setSearch("");
    setDebouncedSearch("");
    setPage(1);
  }, []);

  const goToPage = useCallback((p: number) => setPage(p), []);
  const nextPage = useCallback(() => setPage((p) => Math.min(p + 1, totalPages)), [totalPages]);
  const prevPage = useCallback(() => setPage((p) => Math.max(p - 1, 1)), []);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  return {
    data,
    total,
    page,
    pageSize,
    totalPages,
    isLoading,
    error,
    search,
    setSearch,
    filters,
    setFilter,
    clearFilters,
    goToPage,
    nextPage,
    prevPage,
    refresh,
  };
}
