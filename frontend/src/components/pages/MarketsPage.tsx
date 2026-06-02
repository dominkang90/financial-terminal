import { useEffect } from "react";
import { useMarketStore } from "@/store/marketStore";
import { StockChart } from "@/components/widgets/StockChart";
import { WatchList } from "@/components/widgets/WatchList";
import { MarketPulse } from "@/components/widgets/MarketPulse";
import { QuotePanel } from "@/components/widgets/QuotePanel";
import { NewsFeed } from "@/components/widgets/NewsFeed";

export function MarketsPage() {
  const { fetchChart, activeSymbol, chartPeriod, chartInterval } = useMarketStore();

  useEffect(() => {
    fetchChart(activeSymbol, chartPeriod, chartInterval);
  }, []);

  return (
    <div className="flex h-full overflow-hidden">
      {/* 왼쪽 패널: 관심종목 + 시장 데이터 */}
      <div className="w-56 flex-shrink-0 flex flex-col border-r border-terminal-border overflow-hidden">
        <div className="h-60 flex-shrink-0 border-b border-terminal-border overflow-hidden">
          <WatchList />
        </div>
        <div className="flex-1 overflow-hidden">
          <MarketPulse />
        </div>
      </div>

      {/* 중앙 패널: 차트 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <StockChart />
        </div>
        <div className="h-48 border-t border-terminal-border overflow-hidden">
          <NewsFeed symbolFilter />
        </div>
      </div>

      {/* 오른쪽 패널: 시세 상세 */}
      <div className="w-48 flex-shrink-0 border-l border-terminal-border overflow-hidden">
        <QuotePanel />
      </div>
    </div>
  );
}
