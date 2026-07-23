import { forwardRef } from "react";
import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options?: SelectOption[];
  /** Rendered as the first option with an empty value. */
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
    { label, options, placeholder, className, children, id, ...rest },
    ref,
  ) {
    const field = (
      <select
        ref={ref}
        id={id}
        className={cn(
          "block w-full rounded-lg border border-brand-300 bg-surface-panel px-3 py-2 text-sm text-ink shadow-sm focus:border-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-brand-50 disabled:text-ink-mute",
          className,
        )}
        {...rest}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
        {children}
      </select>
    );
    if (!label) return field;
    return (
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-ink-soft">{label}</span>
        {field}
      </label>
    );
  },
);
