import { useEffect, useState, useCallback } from "react";
import { ExternalLink, RefreshCw, TrendingUp, TrendingDown, Minus, Play, Building2, ImageOff } from "lucide-react";
import { newsApi } from "@/api/client";
import type { NewsArticle } from "@/types";
import { useMarketStore } from "@/store/marketStore";


const SECTOR_FILTERS = [
  { id: "all", label: "전체", keywords: [] },
  { id: "semis", label: "반도체", keywords: ["반도체", "엔비디아", "nvidia", "hbm", "tsmc", "삼성전자", "sk하이닉스", "파운드리", "칩"] },
  { id: "ai", label: "AI", keywords: ["ai", "인공지능", "openai", "데이터센터", "gpu", "소프트웨어"] },
  { id: "space", label: "우주", keywords: ["우주", "space", "spacex", "위성", "발사체", "항공우주"] },
  { id: "ev", label: "전기차/배터리", keywords: ["전기차", "ev", "배터리", "2차전지", "리튬", "테슬라", "catl"] },
  { id: "bio", label: "바이오", keywords: ["바이오", "제약", "헬스케어", "임상", "fda", "신약"] },
  { id: "finance", label: "금융", keywords: ["은행", "증권", "보험", "금융", "카드", "핀테크"] },
  { id: "energy", label: "에너지", keywords: ["에너지", "원전", "석유", "가스", "태양광", "전력", "전기요금"] },
  { id: "defense", label: "방산", keywords: ["방산", "국방", "무기", "defense", "항공", "미사일"] },
  { id: "crypto", label: "암호화폐", keywords: ["비트코인", "이더리움", "코인", "crypto", "bitcoin", "블록체인"] },
  { id: "macro", label: "거시경제", keywords: ["금리", "연준", "fed", "환율", "달러", "물가", "cpi", "고용", "국채", "경기"] },
] as const;

type SectorFilterId = typeof SECTOR_FILTERS[number]["id"];

function articleMatchesSector(article: NewsArticle, sectorId: SectorFilterId) {
  if (sectorId === "all") return true;
  const sector = SECTOR_FILTERS.find((item) => item.id === sectorId);
  if (!sector) return true;
  const haystack = [
    article.title,
    article.title_ko,
    article.summary,
    article.summary_ko,
    article.topic_label,
    ...(article.tags || []),
    ...(article.tickers || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return sector.keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
}

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

function MediaThumbnail({ article }: { article: NewsArticle }) {
  const [imgError, setImgError] = useState(false);
  const isVideo = article.media_type === "video";
  const thumbUrl = isVideo ? article.video_thumbnail : article.image;
  const linkUrl = isVideo ? (article.video_url || article.url) : article.url;

  if (!thumbUrl || imgError) {
    return (
      <div className="w-full aspect-[16/9] bg-[#0d0d0d] border-b border-[#1d1d1d] flex items-center justify-center">
        <div className="flex items-center gap-2 text-[#555] text-2xs font-mono">
          <ImageOff size={12} />
          썸네일 없음
        </div>
      </div>
    );
  }

  return (
    <a href={linkUrl} target="_blank" rel="noopener noreferrer" className="block relative border-b border-[#1d1d1d]">
      <div className="w-full aspect-[16/9] overflow-hidden bg-[#0a0a0a] relative">
        <img
          src={thumbUrl}
          alt={article.title}
          className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-200"
          onError={() => setImgError(true)}
          loading="lazy"
        />
        {isVideo && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/25 group-hover:bg-black/15 transition-colors">
            <div className="w-12 h-12 rounded-full bg-[#ff6600]/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <Play size={20} className="text-white ml-1" fill="white" />
            </div>
          </div>
        )}
      </div>
    </a>
  );
}

function NewsCard({ article }: { article: NewsArticle }) {
  const [showEn, setShowEn] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const sentiment = SENTIMENT_CONFIG[article.sentiment];
  const SentimentIcon = sentiment.icon;
  const title = showEn ? article.title : (article.title_ko || article.title);
  const summary = showEn ? article.summary : (article.summary_ko || article.summary);
  const isVideo = article.media_type === "video";
  const mainUrl = isVideo ? (article.video_url || article.url) : article.url;
  const showLogo = Boolean(article.source_logo && !logoError);

  return (
    <div className="group bg-[#111] hover:bg-[#151515] border border-[#222] hover:border-[#333] rounded-xl overflow-hidden transition-all duration-200 flex flex-col h-full">
      <MediaThumbnail article={article} />

      <div className="p-3 space-y-3 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0 flex-wrap mb-1">
              {showLogo ? (
                <img
                  src={article.source_logo || undefined}
                  alt={article.source}
                  className="w-3.5 h-3.5 rounded-sm object-cover border border-[#2a2a2a]"
                  loading="lazy"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <Building2 size={11} className="text-[#666]" />
              )}
              <span className="text-2xs font-mono text-[#777] truncate">{article.source}</span>
              {article.published_at && (
                <>
                  <span className="text-[#333]">·</span>
                  <span className="text-2xs font-mono text-[#555]">{formatTime(article.published_at)}</span>
                </>
              )}
            </div>
            <a href={mainUrl} target="_blank" rel="noopener noreferrer" className="block">
              <h3 className="text-sm font-medium text-[#ededed] leading-snug hover:text-[#ff6600] transition-colors line-clamp-2">
                {title}
              </h3>
            </a>
          </div>

          <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-mono flex-shrink-0 border ${sentiment.bg} ${sentiment.border} ${sentiment.text}`}>
            <SentimentIcon size={8} />
            {sentiment.label}
          </div>
        </div>

        {summary && (
          <p className="text-xs text-[#8a8a8a] leading-relaxed line-clamp-3 min-h-[3.75rem]">
            {summary}
          </p>
        )}

        <div className="mt-auto pt-1 space-y-2">
          <div className="flex items-center gap-1 flex-wrap">
            {article.importance === "high" && (
              <span className="text-2xs font-mono text-[#ff6600] bg-[#ff6600]/10 border border-[#ff6600]/30 px-1 rounded">HOT</span>
            )}
            {article.tickers.slice(0, 3).map((t) => (
              <span key={t} className="text-2xs font-mono text-[#3399ff] bg-[#3399ff]/10 px-1 rounded">{t}</span>
            ))}
            {article.topic_label && (
              <span className="text-2xs font-mono text-[#7bd389] bg-[#7bd389]/10 px-1 rounded">{article.topic_label}</span>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
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
              {article.title_ko && article.title_ko !== article.title && (
                <button
                  onClick={() => setShowEn(!showEn)}
                  className="text-2xs font-mono text-[#555] hover:text-[#888] transition-colors"
                >
                  {showEn ? "🇰🇷 한글" : "🇺🇸 원문"}
                </button>
              )}
            </div>

            <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-[#444] hover:text-[#ff6600] transition-colors flex-shrink-0">
              <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export function NewsFeed({ symbolFilter, market = "kr" }: { symbolFilter?: boolean; market?: "kr" | "us" }) {
  const { activeSymbol } = useMarketStore();
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "positive" | "negative" | "hot" | "video">("all");
  const [sectorFilter, setSectorFilter] = useState<SectorFilterId>("all");

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const symbol = symbolFilter ? activeSymbol : undefined;
      const data = await newsApi.list(symbol, 40, market);
      setArticles(Array.isArray(data) ? data : []);
    } catch {
      setArticles([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeSymbol, symbolFilter, market]);

  useEffect(() => {
    load();
    const id = setInterval(load, 300_000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    setSectorFilter("all");
  }, [symbolFilter, activeSymbol, market]);


  const filtered = articles.filter((a) => {
    const sectorMatched = articleMatchesSector(a, sectorFilter);
    if (filter === "positive") return a.sentiment === "positive" && sectorMatched;
    if (filter === "negative") return a.sentiment === "negative" && sectorMatched;
    if (filter === "hot") return a.importance === "high" && sectorMatched;
    if (filter === "video") return a.media_type === "video" && sectorMatched;
    return sectorMatched;
  });

  const videoCount = articles.filter((a) => a.media_type === "video").length;

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1a1a1a] flex-shrink-0 flex-wrap">
        <span className="text-xs font-mono text-[#888]">
          {symbolFilter ? `${activeSymbol} 뉴스` : market === "us" ? "미국 주요 시장 뉴스" : "한국 주요 시장 뉴스"}
        </span>
        <span className="text-2xs font-mono text-[#444] hidden sm:block">· 분야별로 빠르게 거르는 시장 뉴스</span>
        <div className="flex-1" />
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

      {isLoading && articles.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <RefreshCw size={20} className="animate-spin text-[#ff6600] mx-auto" />
            <p className="text-xs text-[#555] font-mono">뉴스 + 한국어 번역 중...</p>
            <p className="text-2xs text-[#333] font-mono">처음 로딩은 10~20초 걸려요</p>
          </div>
        </div>
      )}

      {(!isLoading || articles.length > 0) && (
        <div className="flex-1 overflow-y-auto p-3">
          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            <span className="text-2xs font-mono text-[#555] mr-1">분야 필터</span>
            {SECTOR_FILTERS.map((sector) => {
              const count = articles.filter((article) => articleMatchesSector(article, sector.id)).length;
              return (
                <button
                  key={sector.id}
                  type="button"
                  onClick={() => setSectorFilter(sector.id)}
                  className={`px-2 py-1 rounded text-2xs font-mono border ${
                    sectorFilter === sector.id
                      ? "bg-[#ff6600]/10 text-[#ff8833] border-[#ff6600]/40"
                      : "border-[#222] text-[#666] hover:text-[#999]"
                  }`}
                >
                  {sector.label} {count > 0 ? count : ""}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((article) => (
              <NewsCard key={article.id} article={article} />
            ))}
          </div>
          {filtered.length === 0 && !isLoading && (
            <div className="flex items-center justify-center h-32">
              <p className="text-xs text-[#444] font-mono">조건에 맞는 뉴스가 없습니다</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
