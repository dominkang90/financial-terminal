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
    bg: "bg-terminal-green/10", border: "border-terminal-green/30", text: "text-terminal-green",
  },
  negative: {
    label: "부정", icon: TrendingDown,
    bg: "bg-terminal-red/10", border: "border-terminal-red/30", text: "text-terminal-red",
  },
  neutral: {
    label: "중립", icon: Minus,
    bg: "bg-terminal-gray/10", border: "border-terminal-gray/30", text: "text-terminal-gray",
  },
};

function formatTime(dateStr: string): string {
  try {
    const d = new Date(
      dateStr.includes("T") || dateStr.includes("GMT") ? dateStr : Number(dateStr) * 1000
    );
    if (isNaN(d.getTime())) return "시간 확인 중";
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    // 일부 RSS는 UTC/KST 시간이 섞여 가까운 미래 시각으로 들어와요.
    // 사용자에게 고장처럼 보이지 않도록, 하루 이내 미래값은 방금 전으로 표시해요.
    if (mins < -1440) return "시간 확인 중";
    if (mins < 1) return "방금 전";
    if (mins < 60) return `${mins}분 전`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}시간 전`;
    return `${Math.floor(hours / 24)}일 전`;
  } catch { return "시간 확인 중"; }
}

function buildWhyImportant(article: NewsArticle) {
  if (article.importance === "high") return "가격이나 업종 분위기에 영향을 줄 수 있어 먼저 확인해요.";
  if (article.tickers.length > 0) return `관련 종목 ${article.tickers.slice(0, 2).join(", ")} 흐름을 볼 때 참고해요.`;
  if (article.topic_label) return `${article.topic_label} 흐름을 이해하는 데 도움이 돼요.`;
  return "시장 분위기를 넓게 보는 참고 뉴스예요.";
}

function MediaThumbnail({ article }: { article: NewsArticle }) {
  const [imgError, setImgError] = useState(false);
  const isVideo = article.media_type === "video";
  const thumbUrl = isVideo ? article.video_thumbnail : article.image;
  const linkUrl = isVideo ? (article.video_url || article.url) : article.url;

  if (!thumbUrl || imgError) {
    return (
      <div className="w-full aspect-[16/9] bg-terminal-bg/70 border-b border-terminal-border flex items-center justify-center">
        <div className="flex items-center gap-2 text-terminal-text-dim text-2xs font-mono">
          <ImageOff size={12} />
          썸네일 없음
        </div>
      </div>
    );
  }

  return (
    <a href={linkUrl} target="_blank" rel="noopener noreferrer" className="block relative border-b border-terminal-border">
      <div className="w-full aspect-[16/9] overflow-hidden bg-terminal-bg relative">
        <img
          src={thumbUrl}
          alt={article.title}
          className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-200"
          onError={() => setImgError(true)}
          loading="lazy"
        />
        {isVideo && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/25 group-hover:bg-black/15 transition-colors">
            <div className="w-12 h-12 rounded-full bg-terminal-accent/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
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
  const summaryText = summary?.trim() || "요약이 없는 기사예요. 제목과 출처를 먼저 확인해보세요.";
  const isVideo = article.media_type === "video";
  const mainUrl = isVideo ? (article.video_url || article.url) : article.url;
  const showLogo = Boolean(article.source_logo && !logoError);
  const whyImportant = buildWhyImportant(article);

  return (
    <div className="group bg-terminal-panel hover:bg-terminal-header border border-terminal-border hover:border-terminal-gray/60 rounded-xl overflow-hidden transition-all duration-200 flex flex-col h-full">
      <MediaThumbnail article={article} />

      <div className="p-3 space-y-3 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0 flex-wrap mb-1">
              {showLogo ? (
                <img
                  src={article.source_logo || undefined}
                  alt={article.source}
                  className="w-3.5 h-3.5 rounded-sm object-cover border border-terminal-border"
                  loading="lazy"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <Building2 size={11} className="text-terminal-text-dim" />
              )}
              <span className="text-2xs font-mono text-terminal-text-dim truncate">{article.source}</span>
              {article.published_at && (
                <>
                  <span className="text-terminal-border">·</span>
                  <span className="text-2xs font-mono text-terminal-text-dim">{formatTime(article.published_at)}</span>
                </>
              )}
            </div>
            <a href={mainUrl} target="_blank" rel="noopener noreferrer" className="block">
              <h3 className="text-sm font-medium text-terminal-text-primary leading-snug hover:text-terminal-accent transition-colors line-clamp-2">
                {title}
              </h3>
            </a>
          </div>

          <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-mono flex-shrink-0 border ${sentiment.bg} ${sentiment.border} ${sentiment.text}`}>
            <SentimentIcon size={8} />
            {sentiment.label}
          </div>
        </div>

        <p className={`text-xs leading-relaxed line-clamp-3 min-h-[3.75rem] ${summary?.trim() ? "text-terminal-text-secondary" : "text-terminal-text-dim"}`}>
          {summaryText}
        </p>

        <div className="rounded-lg border border-terminal-border bg-terminal-bg/55 px-2 py-1.5 text-[11px] leading-4 text-terminal-text-secondary">
          <span className="font-mono text-terminal-accent">왜 봐요? </span>{whyImportant}
        </div>

        <div className="mt-auto pt-1 space-y-2">
          <div className="flex items-center gap-1 flex-wrap">
            {article.importance === "high" && (
              <span className="text-2xs font-mono text-terminal-accent bg-terminal-accent/10 border border-terminal-accent/30 px-1 rounded">HOT</span>
            )}
            {article.tickers.slice(0, 3).map((t) => (
              <span key={t} className="text-2xs font-mono text-terminal-blue bg-terminal-blue/10 px-1 rounded">{t}</span>
            ))}
            {article.topic_label && (
              <span className="text-2xs font-mono text-terminal-green bg-terminal-green/10 px-1 rounded">{article.topic_label}</span>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              {isVideo && article.video_url && (
                <a
                  href={article.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-2xs font-mono text-terminal-accent hover:text-terminal-accent-dim transition-colors"
                >
                  <Play size={9} />
                  영상 보기
                </a>
              )}
              {article.title_ko && article.title_ko !== article.title && (
                <button
                  onClick={() => setShowEn(!showEn)}
                  className="text-2xs font-mono text-terminal-text-dim hover:text-terminal-text-secondary transition-colors"
                >
                  {showEn ? "🇰🇷 한글" : "🇺🇸 원문"}
                </button>
              )}
            </div>

            <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-terminal-text-dim hover:text-terminal-accent transition-colors flex-shrink-0">
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
  const [sourceFilter, setSourceFilter] = useState("all");

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
    setSourceFilter("all");
  }, [symbolFilter, activeSymbol, market]);

  const sourceOptions = Array.from(new Set(articles.map((article) => article.source).filter(Boolean))).sort();

  const filtered = articles.filter((a) => {
    const sectorMatched = articleMatchesSector(a, sectorFilter);
    const sourceMatched = sourceFilter === "all" || a.source === sourceFilter;
    if (filter === "positive") return a.sentiment === "positive" && sectorMatched && sourceMatched;
    if (filter === "negative") return a.sentiment === "negative" && sectorMatched && sourceMatched;
    if (filter === "hot") return a.importance === "high" && sectorMatched && sourceMatched;
    if (filter === "video") return a.media_type === "video" && sectorMatched && sourceMatched;
    return sectorMatched && sourceMatched;
  });

  const videoCount = articles.filter((a) => a.media_type === "video").length;

  return (
    <div className="flex flex-col h-full bg-terminal-bg">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-terminal-border flex-shrink-0 flex-wrap">
        <span className="text-xs font-mono text-terminal-text-secondary">
          {symbolFilter ? `${activeSymbol} 뉴스` : market === "us" ? "미국 주요 시장 뉴스" : "한국 주요 시장 뉴스"}
        </span>
        <span className="text-2xs font-mono text-terminal-text-dim hidden sm:block">· 분야별로 빠르게 거르는 시장 뉴스</span>
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
                filter === key ? "bg-terminal-accent text-white font-semibold" : "text-terminal-text-dim hover:text-terminal-text-secondary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button onClick={load} disabled={isLoading} className="text-terminal-text-dim hover:text-terminal-text-secondary disabled:opacity-40 ml-1">
          <RefreshCw size={11} className={isLoading ? "animate-spin" : ""} />
        </button>
        <span className="text-2xs text-terminal-border font-mono">{filtered.length}</span>
      </div>

      {isLoading && articles.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <RefreshCw size={20} className="animate-spin text-terminal-accent mx-auto" />
            <p className="text-xs text-terminal-text-dim font-mono">뉴스 + 한국어 번역 중...</p>
            <p className="text-2xs text-terminal-border font-mono">처음 로딩은 10~20초 걸려요</p>
          </div>
        </div>
      )}

      {(!isLoading || articles.length > 0) && (
        <div className="flex-1 overflow-y-auto p-3">
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            <span className="text-2xs font-mono text-terminal-text-dim mr-1">분야 필터</span>
            {SECTOR_FILTERS.map((sector) => {
              const count = articles.filter((article) => articleMatchesSector(article, sector.id)).length;
              return (
                <button
                  key={sector.id}
                  type="button"
                  onClick={() => setSectorFilter(sector.id)}
                  className={`px-2 py-1 rounded text-2xs font-mono border ${
                    sectorFilter === sector.id
                      ? "bg-terminal-accent/10 text-terminal-accent border-terminal-accent/40"
                      : "border-terminal-border text-terminal-text-dim hover:text-terminal-text-primary"
                  }`}
                >
                  {sector.label} {count > 0 ? count : ""}
                </button>
              );
            })}
          </div>

          {sourceOptions.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mb-3 border-b border-terminal-border pb-3">
              <span className="text-2xs font-mono text-terminal-text-dim mr-1">매체 필터</span>
              <button
                type="button"
                onClick={() => setSourceFilter("all")}
                className={`px-2 py-1 rounded text-2xs font-mono border ${
                  sourceFilter === "all"
                    ? "bg-terminal-blue/10 text-terminal-blue border-terminal-blue/40"
                    : "border-terminal-border text-terminal-text-dim hover:text-terminal-text-primary"
                }`}
              >
                전체 {articles.length}
              </button>
              {sourceOptions.map((source) => {
                const count = articles.filter((article) => article.source === source).length;
                return (
                  <button
                    key={source}
                    type="button"
                    onClick={() => setSourceFilter(source)}
                    className={`px-2 py-1 rounded text-2xs font-mono border ${
                      sourceFilter === source
                        ? "bg-terminal-blue/10 text-terminal-blue border-terminal-blue/40"
                        : "border-terminal-border text-terminal-text-dim hover:text-terminal-text-primary"
                    }`}
                  >
                    {source} {count}
                  </button>
                );
              })}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((article) => (
              <NewsCard key={article.id} article={article} />
            ))}
          </div>
          {filtered.length === 0 && !isLoading && (
            <div className="flex items-center justify-center h-32">
              <p className="text-xs text-terminal-text-dim font-mono">조건에 맞는 뉴스가 없습니다</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
