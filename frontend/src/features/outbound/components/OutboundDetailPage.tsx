import Link from "next/link";
import { Badge } from "@/components/Badge";
import { Card } from "@/components/Card";
import { ErrorState } from "@/components/ErrorState";
import { PageHeader } from "@/components/PageHeader";
import { Table } from "@/components/Table";
import type { Column } from "@/components/Table";
import { formatDateTime, formatNumber, getErrorMessage } from "@/lib/utils";
import {
  getProducts,
  getWarehouses,
} from "@/features/inventory/services/inventoryService";
import { getOutboundRequest } from "@/features/outbound/services/outboundService";
import type {
  OutboundItem,
  OutboundRequestDetail,
} from "@/features/outbound/types";
import type { Product, Warehouse } from "@/features/inventory/types";
import { outboundStatusTone } from "@/features/outbound/types";
import { OutboundWorkflow } from "@/features/outbound/components/OutboundWorkflow";

// API line items carry only product_id; resolve labels from the catalog.
function buildItemColumns(
  productLabel: (id: string) => string,
): Column<OutboundItem>[] {
  return [
    {
      key: "product",
      header: "Product",
      render: (item) => (
        <span className="font-medium text-slate-900">
          {productLabel(String(item.product_id))}
        </span>
      ),
    },
    {
      key: "quantity",
      header: "Quantity requested",
      className: "text-right",
      render: (item) => formatNumber(item.quantity_requested),
    },
  ];
}

export async function OutboundDetailPage({ requestId }: { requestId: string }) {
  let request: OutboundRequestDetail;
  let warehouses: Warehouse[];
  let products: Product[];
  try {
    [request, warehouses, products] = await Promise.all([
      getOutboundRequest(requestId),
      getWarehouses(),
      getProducts(),
    ]);
  } catch (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Outbound request" />
        <ErrorState message={getErrorMessage(error)} />
      </div>
    );
  }

  const productById = new Map(products.map((p) => [String(p.id), p]));
  const productLabel = (id: string) => {
    const p = productById.get(id);
    return p ? `${p.sku} — ${p.name}` : id;
  };
  const names = new Map(warehouses.map((w) => [String(w.id), w.name]));
  const source =
    names.get(String(request.source_warehouse_id)) ?? request.source_warehouse_id;
  const destination = request.destination_warehouse_id
    ? names.get(String(request.destination_warehouse_id)) ??
      request.destination_warehouse_id
    : "External customer";

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/outbound"
          className="text-sm text-indigo-600 hover:text-indigo-500 hover:underline"
        >
          ← Back to outbound requests
        </Link>
      </div>

      <PageHeader
        title={`Outbound request #${String(request.id)}`}
        description={`${source} → ${destination}${
          request.created_at ? ` · Created ${formatDateTime(request.created_at)}` : ""
        }`}
        actions={
          <Badge tone={outboundStatusTone(request.status)} className="text-sm">
            {request.status}
          </Badge>
        }
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-1">
          <Card title="Requested items" flush>
            <Table
              columns={buildItemColumns(productLabel)}
              rows={request.items}
              rowKey={(item) => String(item.product_id)}
              emptyMessage="No items on this request."
            />
          </Card>
        </div>
        <div className="xl:col-span-2">
          <OutboundWorkflow request={request} productLabel={productLabel} />
        </div>
      </div>
    </div>
  );
}
