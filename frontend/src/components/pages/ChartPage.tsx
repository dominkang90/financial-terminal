import { StockChart } from "@/components/widgets/StockChart";
import { QuotePanel } from "@/components/widgets/QuotePanel";

export function ChartPage() {
  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-hidden">
        <StockChart />
      </div>
      <div className="hidden md:block w-44 flex-shrink-0 border-l border-terminal-border overflow-hidden">
        <QuotePanel />
      </div>
    </div>
  );
}
