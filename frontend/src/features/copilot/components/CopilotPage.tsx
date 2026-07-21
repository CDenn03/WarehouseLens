import { PageHeader } from "@/components/PageHeader";
import { getWarehouses } from "@/features/inventory/services/inventoryService";
import type { Warehouse } from "@/features/inventory/types";
import { ChatPanel } from "@/features/copilot/components/ChatPanel";

export async function CopilotPage() {
  // If the warehouse list can't be loaded the chat still works — the scope
  // selector just falls back to "All warehouses".
  let warehouses: Warehouse[] = [];
  try {
    warehouses = await getWarehouses();
  } catch {
    warehouses = [];
  }

  return (
    <div className="flex h-full flex-col space-y-6">
      <PageHeader
        title="Copilot"
        description="Ask the operations agent about stock, orders, forecasts and more"
      />
      <ChatPanel warehouses={warehouses} />
    </div>
  );
}
