"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";

export function ProductSearch({ initialValue }: { initialValue: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);

  const apply = (query: string) => {
    router.replace(
      query ? `/inventory?search=${encodeURIComponent(query)}` : "/inventory",
    );
  };

  return (
    <form
      className="flex max-w-md items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        apply(value.trim());
      }}
      role="search"
    >
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search by SKU or name…"
        aria-label="Search products"
      />
      <Button type="submit" variant="secondary">
        Search
      </Button>
      {initialValue && (
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setValue("");
            apply("");
          }}
        >
          Clear
        </Button>
      )}
    </form>
  );
}
