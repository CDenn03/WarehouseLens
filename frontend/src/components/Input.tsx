import { forwardRef } from "react";
import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const baseFieldClasses =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-50 disabled:text-slate-400";

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
        <span className="mb-1 block font-medium text-slate-700">{label}</span>
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
        <span className="mb-1 block font-medium text-slate-700">{label}</span>
        {field}
      </label>
    );
  },
);
