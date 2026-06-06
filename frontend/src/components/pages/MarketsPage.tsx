import { useEffect, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { useMarketStore } from "@/store/marketStore";
import { StockChart } from "@/components/widgets/StockChart";
import { MarketPulse } from "@/components/widgets/MarketPulse";
import { QuotePanel } from "@/components/widgets/QuotePanel";
import { NewsFeed } from "@/components/widgets/NewsFeed";

export function MarketsPage() {
  const { fetchChart, activeSymbol, chartPeriod, chartInterval } = useMarketStore();
  const [chartExpanded, setChartExpanded] = useState(false);
  const [marketPulseCollapsed, setMarketPulseCollapsed] = useState(false);

  useEffect(() => {
    fetchChart(activeSymbol, chartPeriod, chartInterval);
  }, []);

  return (
    <div className="flex h-full overflow-hidden">
      {/* 왼쪽 시장 요약 패널 - 관심종목은 앱 전체 공통 사이드바로 이동 */}
      <div className={`hidden md:flex flex-shrink-0 flex-col border-r border-terminal-border overflow-hidden transition-all duration-200 ${marketPulseCollapsed ? "w-12" : "w-52"}`}>
        <MarketPulse onCollapsedChange={setMarketPulseCollapsed} />
      </div>

      {/* 중앙 패널: 차트를 고정하지 않고 뉴스까지 세로 스크롤 */}
      <div className="flex-1 overflow-y-auto bg-[#0a0a0a]">
        <div className="flex items-center justify-between border-b border-terminal-border bg-[#0d0d0d] px-3 py-2">
          <div className="text-xs font-mono text-terminal-text-secondary">
            {activeSymbol} 차트 · 아래로 스크롤하면 종목 뉴스를 바로 볼 수 있어요
          </div>
          <button
            type="button"
            onClick={() => setChartExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1 rounded border border-terminal-border px-2 py-1 text-2xs font-mono text-terminal-text-secondary hover:text-terminal-text-primary"
          >
            {chartExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            {chartExpanded ? "기본 크기" : "그래프 크게 보기"}
          </button>
        </div>

        <section className={`border-b border-terminal-border ${chartExpanded ? "h-[calc(100vh-132px)] min-h-[640px]" : "h-[520px] min-h-[420px]"}`}>
          <StockChart />
        </section>

        <section className="min-h-[520px]">
          <NewsFeed symbolFilter />
        </section>
      </div>

      {/* 오른쪽 패널 - 데스크톱만 */}
      <div className="hidden lg:block w-48 flex-shrink-0 border-l border-terminal-border overflow-hidden">
        <QuotePanel />
      </div>
    </div>
  );
}
