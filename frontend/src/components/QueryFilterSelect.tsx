"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/Select";
import type { SelectOption } from "@/components/Select";

export interface QueryFilterSelectProps {
  /** URL search param this select controls, e.g. "warehouse_id". */
  param: string;
  options: SelectOption[];
  /** Label for the empty option that clears the filter. */
  allLabel: string;
  label?: string;
  className?: string;
}

/**
 * Generic dropdown that reads/writes a single URL search param.
 * Server components pick the new value up via `searchParams` on navigation.
 */
export function QueryFilterSelect({
  param,
  options,
  allLabel,
  label,
  className,
}: QueryFilterSelectProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get(param) ?? "";

  const handleChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(param, value);
      } else {
        params.delete(param);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    },
    [param, pathname, router, searchParams],
  );

  return (
    <Select
      label={label}
      value={current}
      onChange={(event) => handleChange(event.target.value)}
      placeholder={allLabel}
      options={options}
      className={className}
      aria-label={label ?? allLabel}
    />
  );
}
