import { useEffect, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { useMarketStore } from "@/store/marketStore";
import { StockChart } from "@/components/widgets/StockChart";
import { MarketPulse } from "@/components/widgets/MarketPulse";
import { QuotePanel } from "@/components/widgets/QuotePanel";
import { NewsFeed } from "@/components/widgets/NewsFeed";
import { StockInfoPanel } from "@/components/widgets/StockInfoPanel";

const TABS = [
  { id: "news", label: "뉴스" },
  { id: "info", label: "종목정보" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function MarketsPage() {
  const { fetchChart, activeSymbol, chartPeriod, chartInterval } = useMarketStore();
  const [chartExpanded, setChartExpanded] = useState(false);
  const [marketPulseCollapsed, setMarketPulseCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("news");

  useEffect(() => {
    fetchChart(activeSymbol, chartPeriod, chartInterval);
  }, []);

  return (
    <div className="flex h-full overflow-hidden">
      {/* 왼쪽 시장 요약 패널 */}
      <div className={`hidden md:flex flex-shrink-0 flex-col border-r border-terminal-border overflow-hidden transition-all duration-200 ${marketPulseCollapsed ? "w-12" : "w-52"}`}>
        <MarketPulse onCollapsedChange={setMarketPulseCollapsed} />
      </div>

      {/* 중앙 패널 */}
      <div className="flex-1 overflow-y-auto bg-[#0a0a0a]">
        {/* 차트 헤더 */}
        <div className="flex items-center justify-between border-b border-terminal-border bg-[#0d0d0d] px-3 py-2">
          <div className="text-xs font-mono text-terminal-text-secondary">
            {activeSymbol} 차트
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

        {/* 차트 */}
        <section className={`border-b border-terminal-border ${chartExpanded ? "h-[calc(100vh-132px)] min-h-[480px]" : "h-[320px] min-h-[280px] md:h-[520px] md:min-h-[420px]"}`}>
          <StockChart />
        </section>

        {/* 탭 바 */}
        <div className="flex border-b border-terminal-border bg-[#0d0d0d]">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-xs font-mono transition-colors ${
                activeTab === tab.id
                  ? "text-terminal-accent border-b-2 border-terminal-accent"
                  : "text-terminal-text-dim hover:text-terminal-text-secondary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 탭 콘텐츠 */}
        <section className="min-h-[520px]">
          {activeTab === "news" && <NewsFeed symbolFilter />}
          {activeTab === "info" && <StockInfoPanel symbol={activeSymbol} />}
        </section>
      </div>

      {/* 오른쪽 패널 - 데스크톱만 */}
      <div className="hidden lg:block w-48 flex-shrink-0 border-l border-terminal-border overflow-hidden">
        <QuotePanel />
      </div>
    </div>
  );
}
