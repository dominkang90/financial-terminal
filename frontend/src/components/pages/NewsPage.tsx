import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { NewsFeed } from "@/components/widgets/NewsFeed";
import { VideoNewsFeed } from "@/components/widgets/VideoNewsFeed";
import { WatchList } from "@/components/widgets/WatchList";

export function NewsPage() {
  const [filterBySymbol, setFilterBySymbol] = useState(false);
  const [mode, setMode] = useState<"news" | "video">("news");
  const [watchlistCollapsed, setWatchlistCollapsed] = useState(false);

  return (
    <div className="flex h-full overflow-hidden">
      <div className={`hidden md:block flex-shrink-0 border-r border-terminal-border overflow-hidden transition-all duration-200 ${watchlistCollapsed ? "w-12" : "w-52"}`}>
        {watchlistCollapsed ? (
          <div className="flex h-full flex-col items-center gap-3 bg-[#0b0b0b] py-3">
            <button
              type="button"
              onClick={() => setWatchlistCollapsed(false)}
              className="rounded border border-terminal-border p-1 text-terminal-text-secondary hover:text-terminal-text-primary"
              title="관심종목 열기"
            >
              <ChevronRight size={14} />
            </button>
            <div className="text-[10px] font-mono text-terminal-text-dim [writing-mode:vertical-rl]">관심종목</div>
          </div>
        ) : (
          <WatchList />
        )}
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 px-4 py-2 border-b border-terminal-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWatchlistCollapsed((prev) => !prev)}
              className="hidden md:inline-flex items-center gap-1 rounded border border-terminal-border px-2 py-1 text-xs font-mono text-terminal-text-secondary hover:text-terminal-text-primary"
            >
              {watchlistCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
              관심종목
            </button>
            <button
              onClick={() => setMode("news")}
              className={`text-xs font-mono px-2.5 py-1 rounded ${mode === "news" ? "bg-terminal-accent text-black" : "text-terminal-text-dim hover:text-terminal-text-primary"}`}
            >
              주요 뉴스
            </button>
            <button
              onClick={() => setMode("video")}
              className={`text-xs font-mono px-2.5 py-1 rounded ${mode === "video" ? "bg-terminal-accent text-black" : "text-terminal-text-dim hover:text-terminal-text-primary"}`}
            >
              유튜브 뉴스
            </button>
          </div>

          {mode === "news" && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs font-mono text-terminal-text-secondary">필터:</span>
              <button
                onClick={() => setFilterBySymbol(false)}
                className={`text-xs font-mono px-2 py-0.5 rounded ${!filterBySymbol ? "bg-terminal-accent text-black" : "text-terminal-text-dim hover:text-terminal-text-primary"}`}
              >
                한국 주요 시장 뉴스
              </button>
              <button
                onClick={() => setFilterBySymbol(true)}
                className={`text-xs font-mono px-2 py-0.5 rounded ${filterBySymbol ? "bg-terminal-accent text-black" : "text-terminal-text-dim hover:text-terminal-text-primary"}`}
              >
                현재 종목 뉴스
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-hidden">
          {mode === "news" ? <NewsFeed symbolFilter={filterBySymbol} /> : <VideoNewsFeed />}
        </div>
      </div>
    </div>
  );
}
