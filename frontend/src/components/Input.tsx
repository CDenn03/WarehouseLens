import { forwardRef } from "react";
import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const baseFieldClasses =
  "block w-full rounded-lg border border-brand-300 bg-surface-panel px-3 py-2 text-sm text-ink shadow-sm placeholder:text-ink-mute focus:border-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-brand-50 disabled:text-ink-mute";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ label, className, id, ...rest }, ref) {
    const field = (
      <input
        ref={ref}
        id={id}
        className={cn(baseFieldClasses, className)}
        {...rest}
      />
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

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ label, className, id, ...rest }, ref) {
    const field = (
      <textarea
        ref={ref}
        id={id}
        className={cn(baseFieldClasses, "resize-none", className)}
        {...rest}
      />
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
