import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md";

const variantClasses: Record<Variant, string> = {
  primary:
    "text-[#f4f3ee] disabled:opacity-50",
  secondary:
    "border bg-white disabled:opacity-50",
  danger:
    "bg-red-600 text-white hover:bg-red-500 focus-visible:outline-red-600 disabled:bg-red-300",
  ghost:
    "hover:bg-brand-50 disabled:opacity-40",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-2.5 py-1.5 text-xs",
  md: "px-3.5 py-2 text-sm",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  disabled,
  className,
  children,
  type = "button",
  style,
  ...rest
}: ButtonProps) {
  // Inline CSS vars for the green brand tokens that Tailwind can't resolve at
  // build time from arbitrary values — keeps the component dependency-free.
  const variantStyle =
    variant === "primary"
      ? { background: "var(--green-900)", ...style }
      : variant === "secondary"
      ? { borderColor: "var(--border)", color: "var(--ink-soft)", ...style }
      : variant === "ghost"
      ? { color: "var(--ink-soft)", ...style }
      : style;

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      style={variantStyle}
      {...rest}
    >
      {isLoading && (
        <svg
          className="h-4 w-4 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
