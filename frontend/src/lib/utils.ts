/** Formatting + small shared helpers. Keep this file dependency-free. */

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("en-US");

// Dates are formatted in UTC on purpose.  These helpers run during SSR (server
// timezone) and again during hydration (browser timezone); leaving the zone
// ambient makes the two renders disagree, and React responds to a text mismatch
// by discarding the server HTML and re-rendering the whole document — which
// detaches every event handler on the page.  Pinning the zone keeps both
// renders identical and gives operators one unambiguous timestamp.
const UTC = "UTC";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: UTC,
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: UTC,
});

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return currencyFormatter.format(value);
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return numberFormatter.format(value);
}

/** Formats a fraction (0..1) as a percentage, e.g. 0.8123 -> "81.2%". */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return dateFormatter.format(date);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return dateTimeFormatter.format(date);
}

/** Short axis-label date, e.g. "Jul 19". */
export function formatShortDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: UTC,
  });
}

/** Today's date as an ISO `yyyy-mm-dd` string (for `<input type="date">` defaults). */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Tiny classnames helper. */
export function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

/** Normalizes unknown thrown values into a user-presentable message. */
export function getErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return fallback;
}

/** Standard result shape returned by server actions. */
export interface ActionResult {
  ok: boolean;
  error?: string;
}
