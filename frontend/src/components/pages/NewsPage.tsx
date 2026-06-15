import { useState } from "react";
import { NewsFeed } from "@/components/widgets/NewsFeed";
import { VideoNewsFeed } from "@/components/widgets/VideoNewsFeed";

type NewsMarketFilter = "kr" | "us" | "symbol";

export function NewsPage() {
  const [marketFilter, setMarketFilter] = useState<NewsMarketFilter>("kr");
  const [mode, setMode] = useState<"news" | "video">("news");

  const newsFilterButtons: Array<{ key: NewsMarketFilter; label: string }> = [
    { key: "kr", label: "한국 주요 시장 뉴스" },
    { key: "us", label: "미국 주요 시장 뉴스" },
    { key: "symbol", label: "현재 종목 뉴스" },
  ];

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 px-4 py-2 border-b border-terminal-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode("news")}
              className={`text-xs font-mono px-2.5 py-1 rounded ${mode === "news" ? "bg-terminal-accent text-white" : "text-terminal-text-dim hover:text-terminal-text-primary"}`}
            >
              주요 뉴스
            </button>
            <button
              onClick={() => setMode("video")}
              className={`text-xs font-mono px-2.5 py-1 rounded ${mode === "video" ? "bg-terminal-accent text-white" : "text-terminal-text-dim hover:text-terminal-text-primary"}`}
            >
              유튜브 뉴스
            </button>
          </div>

          {mode === "news" && (
            <div className="flex items-center gap-2 ml-auto overflow-x-auto">
              <span className="text-xs font-mono text-terminal-text-secondary whitespace-nowrap">시장:</span>
              {newsFilterButtons.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setMarketFilter(item.key)}
                  className={`text-xs font-mono px-2 py-0.5 rounded whitespace-nowrap ${marketFilter === item.key ? "bg-terminal-accent text-white" : "text-terminal-text-dim hover:text-terminal-text-primary"}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-hidden">
          {mode === "news" ? (
            <NewsFeed symbolFilter={marketFilter === "symbol"} market={marketFilter === "us" ? "us" : "kr"} />
          ) : (
            <VideoNewsFeed />
          )}
        </div>
      </div>
    </div>
  );
}
