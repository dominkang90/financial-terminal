import { OrderPanel } from "@/components/widgets/OrderPanel";
import { WatchList } from "@/components/widgets/WatchList";
import { StockChart } from "@/components/widgets/StockChart";

export function OrdersPage() {
  return (
    <div className="flex h-full overflow-hidden">
      <div className="w-48 flex-shrink-0 border-r border-terminal-border overflow-hidden">
        <WatchList />
      </div>
      <div className="flex-1 overflow-hidden">
        <StockChart />
      </div>
      <div className="w-56 flex-shrink-0 border-l border-terminal-border overflow-hidden">
        <OrderPanel />
      </div>
    </div>
  );
}
