import { useState } from "react";
import { NewsFeed } from "@/components/widgets/NewsFeed";
import { WatchList } from "@/components/widgets/WatchList";

export function NewsPage() {
  const [filterBySymbol, setFilterBySymbol] = useState(false);

  return (
    <div className="flex h-full overflow-hidden">
      <div className="w-48 flex-shrink-0 border-r border-terminal-border overflow-hidden">
        <WatchList />
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 필터 토글 */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-terminal-border flex-shrink-0">
          <span className="text-xs font-mono text-terminal-text-secondary">뉴스 필터:</span>
          <button
            onClick={() => setFilterBySymbol(false)}
            className={`text-xs font-mono px-2 py-0.5 rounded ${!filterBySymbol ? "bg-terminal-accent text-black" : "text-terminal-text-dim hover:text-terminal-text-primary"}`}
          >
            전체 뉴스
          </button>
          <button
            onClick={() => setFilterBySymbol(true)}
            className={`text-xs font-mono px-2 py-0.5 rounded ${filterBySymbol ? "bg-terminal-accent text-black" : "text-terminal-text-dim hover:text-terminal-text-primary"}`}
          >
            종목별 뉴스
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <NewsFeed symbolFilter={filterBySymbol} />
        </div>
      </div>
    </div>
  );
}
