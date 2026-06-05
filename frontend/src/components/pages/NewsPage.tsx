import { useState } from "react";
import { NewsFeed } from "@/components/widgets/NewsFeed";
import { VideoNewsFeed } from "@/components/widgets/VideoNewsFeed";
import { WatchList } from "@/components/widgets/WatchList";

export function NewsPage() {
  const [filterBySymbol, setFilterBySymbol] = useState(false);
  const [mode, setMode] = useState<"news" | "video">("news");

  return (
    <div className="flex h-full overflow-hidden">
      <div className="hidden md:block w-52 flex-shrink-0 border-r border-terminal-border overflow-hidden">
        <WatchList />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 px-4 py-2 border-b border-terminal-border flex-shrink-0">
          <div className="flex items-center gap-2">
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
