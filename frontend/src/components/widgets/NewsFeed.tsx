import { useEffect, useState } from "react";
import { ExternalLink, RefreshCw, Languages, ChevronDown, ChevronUp } from "lucide-react";
import { newsApi } from "@/api/client";
import type { NewsArticle } from "@/types";
import { useMarketStore } from "@/store/marketStore";
import { useSettingsStore } from "@/store/settingsStore";

const SENTIMENT_COLORS = {
  positive: "text-terminal-green border-terminal-green/40",
  negative: "text-terminal-red border-terminal-red/40",
  neutral: "text-terminal-text-dim border-terminal-border",
};

const SENTIMENT_LABELS = {
  positive: "긍정",
  negative: "부정",
  neutral: "중립",
};

export function NewsFeed({ symbolFilter }: { symbolFilter?: boolean }) {
  const { activeSymbol } = useMarketStore();
  const { geminiApiKey } = useSettingsStore();
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translating, setTranslating] = useState<Record<string, boolean>>({});

  const load = async () => {
    setIsLoading(true);
    try {
      const symbol = symbolFilter ? activeSymbol : undefined;
      const data = await newsApi.list(symbol, 40);
      setArticles(data);
    } catch {
      setArticles([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 300_000);
    return () => clearInterval(id);
  }, [activeSymbol, symbolFilter]);

  const translate = async (article: NewsArticle) => {
    if (translations[article.id]) return;
    setTranslating((prev) => ({ ...prev, [article.id]: true }));
    try {
      const text = `${article.title}\n\n${article.summary}`;
      const result = await newsApi.translate(text, geminiApiKey || undefined);
      if (result.translation) {
        setTranslations((prev) => ({ ...prev, [article.id]: result.translation! }));
      } else {
        setTranslations((prev) => ({ ...prev, [article.id]: "Gemini API 키가 필요합니다. 설정에서 입력해주세요." }));
      }
    } catch {
      setTranslations((prev) => ({ ...prev, [article.id]: "번역 실패" }));
    } finally {
      setTranslating((prev) => ({ ...prev, [article.id]: false }));
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-terminal-border flex-shrink-0">
        <span className="text-xs font-mono text-terminal-text-secondary">
          {symbolFilter ? `${activeSymbol} 뉴스` : "최신 뉴스"}
        </span>
        {isLoading ? (
          <RefreshCw size={11} className="text-terminal-text-dim animate-spin ml-auto" />
        ) : (
          <button onClick={load} className="ml-auto text-terminal-text-dim hover:text-terminal-text-primary">
            <RefreshCw size={11} />
          </button>
        )}
        <span className="text-2xs text-terminal-text-dim font-mono">{articles.length}건</span>
      </div>

      {/* 기사 목록 */}
      <div className="flex-1 overflow-y-auto divide-y divide-terminal-border">
        {articles.map((a) => {
          const isExpanded = expandedId === a.id;
          const hasTranslation = !!translations[a.id];

          return (
            <div key={a.id} className="p-3 hover:bg-terminal-border/30 transition-colors">
              {/* 상단 메타 */}
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-2xs font-mono border rounded-sm px-1 ${SENTIMENT_COLORS[a.sentiment]}`}>
                  {SENTIMENT_LABELS[a.sentiment]}
                </span>
                {a.importance === "high" && (
                  <span className="text-2xs font-mono text-terminal-accent border border-terminal-accent/40 rounded-sm px-1">HOT</span>
                )}
                <span className="text-2xs text-terminal-text-dim font-mono ml-auto">{a.source}</span>
                <span className="text-2xs text-terminal-text-dim font-mono">{formatNewsDate(a.published_at)}</span>
              </div>

              {/* 제목 */}
              <button
                className="text-left w-full"
                onClick={() => setExpandedId(isExpanded ? null : a.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className={`text-xs font-mono leading-relaxed ${isExpanded ? "text-terminal-text-primary" : "text-terminal-text-primary/90"}`}>
                    {a.title}
                  </span>
                  {isExpanded ? <ChevronUp size={11} className="flex-shrink-0 text-terminal-text-dim mt-0.5" /> : <ChevronDown size={11} className="flex-shrink-0 text-terminal-text-dim mt-0.5" />}
                </div>
              </button>

              {/* 관련 티커 */}
              {a.tickers.length > 0 && (
                <div className="flex gap-1 mt-1 flex-wrap">
                  {a.tickers.map((t) => (
                    <span key={t} className="text-2xs font-mono text-terminal-blue bg-terminal-blue/10 px-1 rounded-sm">{t}</span>
                  ))}
                </div>
              )}

              {/* 펼쳐진 내용 */}
              {isExpanded && (
                <div className="mt-2 space-y-2">
                  {a.summary && (
                    <p className="text-2xs text-terminal-text-secondary font-mono leading-relaxed">{a.summary}</p>
                  )}

                  {/* 번역 */}
                  {hasTranslation ? (
                    <div className="p-2 bg-terminal-bg border border-terminal-border rounded">
                      <div className="text-2xs text-terminal-yellow font-mono mb-1">🇰🇷 한국어 번역</div>
                      <p className="text-2xs text-terminal-text-primary leading-relaxed">{translations[a.id]}</p>
                    </div>
                  ) : (
                    <button
                      onClick={() => translate(a)}
                      disabled={translating[a.id]}
                      className="flex items-center gap-1 text-2xs text-terminal-blue hover:text-terminal-blue/80 font-mono disabled:opacity-50"
                    >
                      <Languages size={10} />
                      {translating[a.id] ? "번역 중..." : "한국어로 번역"}
                    </button>
                  )}

                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-2xs text-terminal-text-dim hover:text-terminal-accent font-mono"
                  >
                    <ExternalLink size={9} />
                    원문 보기
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatNewsDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}분 전`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}시간 전`;
    return `${Math.floor(hours / 24)}일 전`;
  } catch {
    return "";
  }
}
