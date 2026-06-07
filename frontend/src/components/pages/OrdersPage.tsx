import { OrderPanel } from "@/components/widgets/OrderPanel";
import { StockChart } from "@/components/widgets/StockChart";

export function OrdersPage() {
  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-hidden">
        <StockChart />
      </div>
      <div className="hidden md:block w-56 flex-shrink-0 border-l border-terminal-border overflow-hidden">
        <OrderPanel />
      </div>
    </div>
  );
}
