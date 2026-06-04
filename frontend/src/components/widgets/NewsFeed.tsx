import { useEffect, useState, useCallback } from "react";
import { ExternalLink, RefreshCw, TrendingUp, TrendingDown, Minus, Play } from "lucide-react";
import { newsApi } from "@/api/client";
import type { NewsArticle } from "@/types";
import { useMarketStore } from "@/store/marketStore";

const SENTIMENT_CONFIG = {
  positive: {
    label: "긍정", icon: TrendingUp,
    bg: "bg-green-500/10", border: "border-green-500/30", text: "text-green-400",
  },
  negative: {
    label: "부정", icon: TrendingDown,
    bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-400",
  },
  neutral: {
    label: "중립", icon: Minus,
    bg: "bg-gray-500/10", border: "border-gray-500/30", text: "text-gray-400",
  },
};

function formatTime(dateStr: string): string {
  try {
    const d = new Date(
      dateStr.includes("T") || dateStr.includes("GMT") ? dateStr : Number(dateStr) * 1000
    );
    if (isNaN(d.getTime())) return "";
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}분 전`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}시간 전`;
    return `${Math.floor(hours / 24)}일 전`;
  } catch { return ""; }
}

// 미디어 썸네일 (이미지 or 영상)
function MediaThumbnail({ article }: { article: NewsArticle }) {
  const [imgError, setImgError] = useState(false);
  const isVideo = article.media_type === "video";
  const thumbUrl = isVideo ? article.video_thumbnail : article.image;
  const linkUrl = isVideo ? (article.video_url || article.url) : article.url;

  if (!thumbUrl || imgError) return null;

  return (
    <a href={linkUrl} target="_blank" rel="noopener noreferrer" className="block relative">
      <div className="w-full h-40 overflow-hidden bg-[#0a0a0a] relative">
        <img
          src={thumbUrl}
          alt={article.title}
          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-200"
          onError={() => setImgError(true)}
          loading="lazy"
        />
        {/* 영상일 때 재생 버튼 오버레이 */}
        {isVideo && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/20 transition-colors">
            <div className="w-12 h-12 rounded-full bg-[#ff6600]/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <Play size={20} className="text-white ml-1" fill="white" />
            </div>
          </div>
        )}
        {/* 영상 배지 */}
        {isVideo && (
          <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-[#ff6600] rounded text-2xs font-mono text-black font-bold flex items-center gap-1">
            <Play size={8} fill="black" />
            VIDEO
          </div>
        )}
      </div>
    </a>
  );
}

function NewsCard({ article }: { article: NewsArticle }) {
  const [showEn, setShowEn] = useState(false);
  const sentiment = SENTIMENT_CONFIG[article.sentiment];
  const SentimentIcon = sentiment.icon;
  const title = showEn ? article.title : (article.title_ko || article.title);
  const summary = showEn ? article.summary : (article.summary_ko || article.summary);
  const isVideo = article.media_type === "video";
  const mainUrl = isVideo ? (article.video_url || article.url) : article.url;

  return (
    <div className="group bg-[#111] hover:bg-[#161616] border border-[#222] hover:border-[#333] rounded-lg overflow-hidden transition-all duration-200 flex flex-col">
      {/* 썸네일 (이미지 or 영상) */}
      <MediaThumbnail article={article} />

      <div className="p-3 space-y-2 flex-1 flex flex-col">
        {/* 상단: 출처 + 시간 + 감성 */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-2xs font-mono text-[#555] truncate">{article.source}</span>
            {article.published_at && (
              <>
                <span className="text-[#333]">·</span>
                <span className="text-2xs font-mono text-[#444]">{formatTime(article.published_at)}</span>
              </>
            )}
          </div>
          <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-mono flex-shrink-0 border ${sentiment.bg} ${sentiment.border} ${sentiment.text}`}>
            <SentimentIcon size={8} />
            {sentiment.label}
          </div>
        </div>

        {/* 제목 */}
        <a href={mainUrl} target="_blank" rel="noopener noreferrer" className="block flex-1">
          <h3 className="text-xs font-medium text-[#e0e0e0] leading-relaxed hover:text-[#ff6600] transition-colors line-clamp-3">
            {title}
          </h3>
        </a>

        {/* 요약 */}
        {summary && (
          <p className="text-2xs text-[#666] leading-relaxed line-clamp-2">{summary}</p>
        )}

        {/* 하단 */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-1 flex-wrap">
            {article.importance === "high" && (
              <span className="text-2xs font-mono text-[#ff6600] bg-[#ff6600]/10 border border-[#ff6600]/30 px-1 rounded">HOT</span>
            )}
            {article.tickers.slice(0, 3).map((t) => (
              <span key={t} className="text-2xs font-mono text-[#3399ff] bg-[#3399ff]/10 px-1 rounded">{t}</span>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* 영상 바로가기 */}
            {isVideo && article.video_url && (
              <a
                href={article.video_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-2xs font-mono text-[#ff6600] hover:text-[#ff8833] transition-colors"
              >
                <Play size={9} />
                영상 보기
              </a>
            )}
            {/* 한/영 토글 */}
            {article.title_ko && (
              <button
                onClick={() => setShowEn(!showEn)}
                className="text-2xs font-mono text-[#555] hover:text-[#888] transition-colors"
              >
                {showEn ? "🇰🇷" : "🇺🇸"}
              </button>
            )}
            <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-[#444] hover:text-[#ff6600] transition-colors">
              <ExternalLink size={10} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export function NewsFeed({ symbolFilter }: { symbolFilter?: boolean }) {
  const { activeSymbol } = useMarketStore();
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "positive" | "negative" | "hot" | "video">("all");

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const symbol = symbolFilter ? activeSymbol : undefined;
      const data = await newsApi.list(symbol, 40);
      setArticles(Array.isArray(data) ? data : []);
    } catch {
      setArticles([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeSymbol, symbolFilter]);

  useEffect(() => {
    load();
    const id = setInterval(load, 300_000);
    return () => clearInterval(id);
  }, [load]);

  const filtered = articles.filter((a) => {
    if (filter === "positive") return a.sentiment === "positive";
    if (filter === "negative") return a.sentiment === "negative";
    if (filter === "hot") return a.importance === "high";
    if (filter === "video") return a.media_type === "video";
    return true;
  });

  const videoCount = articles.filter((a) => a.media_type === "video").length;

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1a1a1a] flex-shrink-0">
        <span className="text-xs font-mono text-[#888]">
          {symbolFilter ? `${activeSymbol} 뉴스` : "시장 뉴스"}
        </span>
        <span className="text-2xs font-mono text-[#444] hidden sm:block">· 한국어 자동번역</span>
        <div className="flex-1" />
        {/* 필터 */}
        <div className="flex items-center gap-0.5 overflow-x-auto">
          {([
            { key: "all", label: "전체" },
            { key: "hot", label: "🔥" },
            { key: "video", label: `▶ ${videoCount > 0 ? videoCount : ""}` },
            { key: "positive", label: "긍정" },
            { key: "negative", label: "부정" },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-2 py-0.5 text-2xs font-mono rounded whitespace-nowrap transition-colors ${
                filter === key ? "bg-[#ff6600] text-black font-semibold" : "text-[#555] hover:text-[#888]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button onClick={load} disabled={isLoading} className="text-[#444] hover:text-[#888] disabled:opacity-40 ml-1">
          <RefreshCw size={11} className={isLoading ? "animate-spin" : ""} />
        </button>
        <span className="text-2xs text-[#333] font-mono">{filtered.length}</span>
      </div>

      {/* 로딩 */}
      {isLoading && articles.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <RefreshCw size={20} className="animate-spin text-[#ff6600] mx-auto" />
            <p className="text-xs text-[#555] font-mono">뉴스 + 한국어 번역 중...</p>
            <p className="text-2xs text-[#333] font-mono">처음 로딩은 10~20초 걸려요</p>
          </div>
        </div>
      )}

      {/* 카드 그리드 - 모바일: 1열 / 태블릿: 2열 / 데스크톱: 3열 */}
      {(!isLoading || articles.length > 0) && (
        <div className="flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((article) => (
              <NewsCard key={article.id} article={article} />
            ))}
          </div>
          {filtered.length === 0 && !isLoading && (
            <div className="flex items-center justify-center h-32">
              <p className="text-xs text-[#444] font-mono">뉴스가 없습니다</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
