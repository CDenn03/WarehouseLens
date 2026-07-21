"use client";

import { Button } from "@/components/Button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <h1 className="text-lg font-semibold text-slate-900">
        Something went wrong
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        {error.message || "An unexpected error occurred while rendering this page."}
      </p>
      <div className="mt-6">
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
