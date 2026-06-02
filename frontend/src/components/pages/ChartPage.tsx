import { StockChart } from "@/components/widgets/StockChart";
import { WatchList } from "@/components/widgets/WatchList";
import { QuotePanel } from "@/components/widgets/QuotePanel";

export function ChartPage() {
  return (
    <div className="flex h-full overflow-hidden">
      <div className="w-48 flex-shrink-0 border-r border-terminal-border overflow-hidden">
        <WatchList />
      </div>
      <div className="flex-1 overflow-hidden">
        <StockChart />
      </div>
      <div className="w-44 flex-shrink-0 border-l border-terminal-border overflow-hidden">
        <QuotePanel />
      </div>
    </div>
  );
}
