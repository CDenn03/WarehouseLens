import type { Supplier } from "@/features/procurement/types";

export function SuppliersList({ suppliers }: { suppliers: Supplier[] }) {
  if (suppliers.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-sm text-slate-400">
        No suppliers yet — add one to start ordering.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-slate-100">
      {suppliers.map((supplier) => (
        <li key={String(supplier.id)} className="px-5 py-3">
          <p className="text-sm font-medium text-slate-900">{supplier.name}</p>
          {(supplier.contact_email ||
            supplier.lead_time_days != null) && (
            <p className="mt-0.5 text-xs text-slate-500">
              {[
                supplier.contact_email,
                supplier.lead_time_days != null
                  ? `${supplier.lead_time_days}-day lead time`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
