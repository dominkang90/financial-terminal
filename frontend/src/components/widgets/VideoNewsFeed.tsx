import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ArrowUpRight, BarChart3, ExternalLink, Play, RefreshCw, ShieldCheck, Sparkles, Tags } from "lucide-react";
import { Virtuoso } from "react-virtuoso";
import { newsApi } from "@/api/client";
import type { ChannelConsensusItem, NewsArticle, VideoDeskGuideLayer, VideoNewsResponse } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "";
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${Math.max(mins, 1)}분 전`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}시간 전`;
    return `${Math.floor(hours / 24)}일 전`;
  } catch {
    return "";
  }
}

function formatDate(dateStr: string): string {
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

function getSentimentMeta(sentiment?: string) {
  if (sentiment === "positive") {
    return { label: "BULLISH", className: "border-emerald-400/18 bg-emerald-400/14 text-emerald-200" };
  }
  if (sentiment === "negative") {
    return { label: "BEARISH", className: "border-rose-400/18 bg-rose-400/14 text-rose-200" };
  }
  return { label: "NEUTRAL", className: "border-amber-300/18 bg-amber-300/14 text-amber-100" };
}

function tierTone(tier?: string) {
  if (tier === "s") return "border-sky-300/20 bg-sky-300/10 text-sky-100";
  if (tier === "a") return "border-amber-300/20 bg-amber-300/10 text-amber-100";
  return "border-emerald-300/20 bg-emerald-300/10 text-emerald-100";
}

function cleanReadableText(text?: string | null) {
  return (text || "")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/www\.\S+/g, " ")
    .replace(/#([\w가-힣_]+)/g, " ")
    .replace(/\[(music|applause|laughs?)\]/gi, " ")
    .replace(/={3,}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isPromotionalLine(text: string) {
  const lowered = text.toLowerCase();
  const promoTokens = ["구독", "좋아요", "알림", "멤버십", "문의", "프리미엄", "이벤트", "구매", "할인", "링크", "바로가기"];
  if (lowered.includes("http") || lowered.includes("bit.ly") || lowered.includes("abr.ge")) return true;
  return promoTokens.filter((token) => lowered.includes(token)).length >= 2;
}

function splitBullets(...inputs: Array<string | undefined | null>) {
  const joined = inputs.map((item) => cleanReadableText(item)).filter(Boolean).join("\n");
  return joined
    .split(/\n|•|·|(?<=[.!?다])\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 14)
    .filter((item) => !isPromotionalLine(item))
    .slice(0, 4);
}

function buildActionBullets(article: NewsArticle) {
  if (!article.transcript_available) {
    return ["이 영상은 아직 내용을 확보하지 못했습니다.", "영상 열기 버튼으로 원문 내용을 직접 확인해 주세요."];
  }

  const bullets = splitBullets(article.transcript_excerpt, article.insight);
  return bullets.length > 0 ? bullets.slice(0, 3) : ["영상 내용은 가져왔지만 아직 핵심 문장을 뽑는 중입니다."];
}

function summaryCards(videos: NewsArticle[], marketScore: number) {
  const bullish = videos.filter((item) => item.sentiment === "positive").length;
  const bearish = videos.filter((item) => item.sentiment === "negative").length;
  const neutral = videos.length - bullish - bearish;

  return [
    {
      title: "시장 온도",
      value: `${marketScore}점`,
      hint: "영상 톤과 중요도를 함께 반영한 체감 점수",
      accent: "text-[#FFD27D]",
    },
    {
      title: "상승 시각",
      value: `${bullish}건`,
      hint: "긍정적으로 해석한 채널 수",
      accent: "text-[#9EF7CC]",
    },
    {
      title: "하락 경계",
      value: `${bearish}건`,
      hint: "리스크를 강조한 채널 수",
      accent: "text-[#FF9DA5]",
    },
    {
      title: "중립/관망",
      value: `${neutral}건`,
      hint: "팩트 확인 또는 방향성 대기",
      accent: "text-[#B4C2FF]",
    },
  ];
}

function FilterButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition",
        active
          ? "border-[#ff6600]/45 bg-[#ff6600]/12 text-[#ffb066]"
          : "border-[#222] bg-[#111] text-[#777] hover:border-[#333] hover:text-[#ddd]",
      )}
    >
      <span>{label}</span>
      {typeof count === "number" && <span className="text-[10px] opacity-75">{count}</span>}
    </button>
  );
}

function MetricCard({ title, value, hint, accent }: { title: string; value: string; hint: string; accent: string }) {
  return (
    <Card className="rounded-xl border border-[#1f1f1f] bg-[#111]">
      <CardHeader className="pb-3">
        <CardDescription>{title}</CardDescription>
        <CardTitle className={cn("text-2xl", accent)}>{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs leading-relaxed text-white/50">{hint}</p>
      </CardContent>
    </Card>
  );
}

function GuideLayerCard({ layer }: { layer: VideoDeskGuideLayer }) {
  return (
    <Card className="rounded-xl border border-[#1f1f1f] bg-[#111]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{layer.label}</CardTitle>
          <Badge className={cn("px-2 py-1 text-[10px]", tierTone(layer.tier))}>{layer.tier.toUpperCase()}</Badge>
        </div>
        <CardDescription>{layer.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {layer.sources.map((source) => (
          <Badge key={source} className="border-white/10 bg-white/[0.03] text-white/60">
            {source}
          </Badge>
        ))}
      </CardContent>
    </Card>
  );
}

function ConsensusRow({ item }: { item: ChannelConsensusItem }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[#1f1f1f] bg-[#111] px-3 py-3">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-white">{item.source}</div>
        <div className="truncate text-[11px] text-white/45">{item.tier_label || item.layer_label || "시장 해석"}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-xs font-semibold text-[#C5FFE3]">{item.stance}</div>
        <div className="text-[11px] text-white/45">{item.count}건</div>
      </div>
    </div>
  );
}

function VideoListCard({
  article,
  active,
  onSelect,
}: {
  article: NewsArticle;
  active: boolean;
  onSelect: (article: NewsArticle) => void;
}) {
  const sentiment = getSentimentMeta(article.sentiment);
  const tags = (article.tags || []).slice(0, 5);

  return (
    <motion.button
      layout
      whileHover={{ y: -2 }}
      onClick={() => onSelect(article)}
      className={cn(
        "group relative w-full rounded-xl border p-3 text-left transition duration-200",
        active
          ? "border-[#ff6600]/40 bg-[#151515] shadow-[0_10px_24px_rgba(0,0,0,0.18)]"
          : "border-[#222] bg-[#111] hover:border-[#333] hover:bg-[#151515]",
      )}
    >
      {active && (
        <div className="pointer-events-none absolute -right-3 top-1/2 hidden -translate-y-1/2 rounded-full border border-[#ff6600]/30 bg-[#ff6600]/12 p-2 text-[#ffb066] lg:flex">
          <ArrowRight size={14} />
        </div>
      )}
      <div className="flex gap-4">
        <div className="relative h-[78px] w-[112px] shrink-0 overflow-hidden rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] md:h-[84px] md:w-[118px]">
          <img
            src={article.video_thumbnail || article.image || "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg"}
            alt={article.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-[#0B1325]/70 via-transparent to-transparent" />
          <div className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-1 text-[10px] text-white/90 backdrop-blur">
            <Play size={10} fill="currentColor" />
            영상
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="line-clamp-2 text-[14px] font-semibold leading-5 text-white md:text-[15px] md:leading-6">{article.title_ko || article.title}</div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#666] md:text-xs">
                <span className="font-medium text-[#ff8833]">{article.source}</span>
                <span>{formatDate(article.published_at)}</span>
                <span>{formatTime(article.published_at)}</span>
              </div>
            </div>
            <Badge className={cn("shrink-0", sentiment.className)}>{sentiment.label}</Badge>
          </div>

          <div className="mt-2.5 flex flex-wrap gap-2">
            {article.tier_label && <Badge className={cn("text-[10px]", tierTone(article.tier))}>{article.tier_label}</Badge>}
            {article.topic_label && <Badge className="border-[#222] bg-[#161616] text-[#888]">{article.topic_label}</Badge>}
            {article.region_label && <Badge className="border-[#2a2a2a] bg-[#131313] text-[#9db8d6]">{article.region_label}</Badge>}
          </div>

          {article.insight && <p className="mt-2.5 line-clamp-2 text-[13px] leading-5 text-[#8a8a8a] md:text-sm md:leading-6">{article.insight}</p>}

          <div className="mt-2.5 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Badge key={tag} className="border-[#222] bg-[#171717] text-[#777]">
                {tag}
              </Badge>
            ))}
          </div>

          <div className="mt-2 flex items-center gap-2 text-[11px] text-[#555]">
            <span className="inline-flex items-center gap-1">
              선택해서 분석 보기
              <ArrowUpRight size={12} className="transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </span>
          </div>
        </div>
      </div>
    </motion.button>
  );
}

function DetailPanel({ article, overallInsight }: { article: NewsArticle | null; overallInsight?: string }) {
  if (!article) {
    return (
      <Card className="flex h-full min-h-[420px] items-center justify-center rounded-[32px] border-dashed border-white/10 bg-white/[0.02]">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]">
            <Sparkles size={18} className="text-[#8EF3C5]" />
          </div>
          <div className="text-base font-semibold text-white">뉴스 카드를 선택하세요</div>
          <p className="mt-2 text-sm leading-6 text-white/55">왼쪽 리스트에서 영상을 고르면 AI 인사이트와 액션 포인트를 오른쪽에 크게 보여줍니다.</p>
        </div>
      </Card>
    );
  }

  const bullets = splitBullets(article.transcript_excerpt, article.insight, overallInsight);
  const actionBullets = buildActionBullets(article);
  const tags = article.tags || [];
  const sentiment = getSentimentMeta(article.sentiment);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={article.id}
        initial={{ opacity: 0, x: 18 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -12 }}
        transition={{ duration: 0.2 }}
        className="h-full"
      >
        <Card className="h-full rounded-2xl border border-[#1f1f1f] bg-[#111]">
          <ScrollArea className="h-full max-h-[calc(100vh-190px)] px-6 py-6 lg:max-h-[calc(100vh-170px)]">
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 gap-4">
                  <div className="h-[126px] w-[176px] shrink-0 overflow-hidden rounded-xl border border-[#1f1f1f] bg-[#0a0a0a]">
                    <img
                      src={article.video_thumbnail || article.image || "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg"}
                      alt={article.title}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-sm text-[#666]">
                      <span className="font-medium text-[#ff8833]">{article.source}</span>
                      <span>{formatDate(article.published_at)}</span>
                      <span>{formatTime(article.published_at)}</span>
                    </div>
                    <h2 className="mt-3 text-[24px] font-semibold leading-[1.4] text-white md:text-[28px]">{article.title_ko || article.title}</h2>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Badge className={cn(sentiment.className)}>{sentiment.label}</Badge>
                      {article.tier_label && <Badge className={cn(tierTone(article.tier))}>{article.tier_label}</Badge>}
                      {article.layer_label && <Badge className="border-[#222] bg-[#161616] text-[#888]">{article.layer_label}</Badge>}
                      {article.region_label && <Badge className="border-[#2a2a2a] bg-[#131313] text-[#9db8d6]">{article.region_label}</Badge>}
                    </div>
                  </div>
                </div>
              </div>

              <Card className="rounded-xl border border-[#1f1f1f] bg-[#141414]">
                <CardHeader>
                  <CardTitle className="text-[#ffb066]">영상 내용 요약</CardTitle>
                  <CardDescription>더보기/설명란이 아니라 영상 안에서 확보한 내용만 먼저 보여줍니다.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-[16px] leading-7 text-white/82">
                  <p>{article.insight || overallInsight || "분석 요약을 준비 중입니다."}</p>
                  {article.transcript_available ? (
                    bullets.length > 0 ? (
                      <ul className="space-y-3 text-[15px] leading-7 text-white/72">
                        {bullets.map((bullet) => (
                          <li key={bullet} className="flex gap-3">
                            <span className="mt-2 text-white/45">▸</span>
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="rounded-lg border border-[#242424] bg-[#101010] p-3 text-sm leading-6 text-[#8d8d8d]">
                        영상 내용은 가져왔지만 아직 핵심 문장을 정리하는 중입니다.
                      </div>
                    )
                  ) : (
                    <div className="rounded-lg border border-[#242424] bg-[#101010] p-3 text-sm leading-6 text-[#8d8d8d]">
                      이 영상은 자막이나 영상 요약을 가져오지 못해서, 영상 내용 기반 요약을 숨겼습니다.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-xl border border-[#1f1f1f] bg-[#141414]">
                <CardHeader>
                  <CardTitle className="text-white">체크 포인트</CardTitle>
                  <CardDescription>실전에서 먼저 확인할 것만 짧게 정리했습니다.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-[15px] leading-7 text-white/80">
                  <ul className="space-y-3">
                    {actionBullets.map((bullet) => (
                      <li key={bullet} className="flex gap-3">
                        <span className="mt-2 text-[#ffb066]">•</span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="rounded-xl border border-[#242424] bg-[#101010] p-4 text-sm leading-6 text-white/55">
                    {article.source_role || article.layer_label || "전문가 해설"} 관점입니다. 실제 매매 전에는 원문 영상과 주요 수급/실적 데이터를 같이 확인하세요.
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-xl border border-[#1f1f1f] bg-[#141414]">
                <CardHeader>
                  <CardTitle>관련 태그</CardTitle>
                  <CardDescription>주제 태그와 원문 링크를 빠르게 확인할 수 있습니다.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex flex-wrap gap-2">
                    {tags.length > 0 ? (
                      tags.map((tag) => (
                        <Badge key={tag} className="border-[#222] bg-[#171717] text-[#888]">
                          {tag}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-white/45">등록된 태그가 없습니다.</span>
                    )}
                  </div>
                  <Separator />
                  <div className="flex flex-wrap gap-3">
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-[#2a2a2a] bg-[#111] px-4 py-2 text-sm text-white/78 transition hover:border-[#3a3a3a] hover:text-white"
                    >
                      <ExternalLink size={14} />
                      원문 보기
                    </a>
                    <a
                      href={article.video_url || article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-[#ff6600]/25 bg-[#ff6600]/10 px-4 py-2 text-sm text-[#ffcf9b] transition hover:bg-[#ff6600]/14"
                    >
                      <Play size={14} />
                      영상 열기
                    </a>
                  </div>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}

export function VideoNewsFeed() {
  const [payload, setPayload] = useState<VideoNewsResponse | null>(null);
  const [topic, setTopic] = useState("all");
  const [tier, setTier] = useState("all");
  const [source, setSource] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const [selected, setSelected] = useState<NewsArticle | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [detailSide, setDetailSide] = useState<"bottom" | "right">("right");

  const load = useCallback(async (topicValue: string) => {
    setIsLoading(true);
    try {
      const data = await newsApi.videos(topicValue, 36);
      setPayload(data);
    } catch {
      setPayload({
        videos: [],
        topics: [{ id: "all", label: "전체" }],
        tier_filters: [],
        source_filters: [],
        desk_guide: { layers: [], excluded: [] },
        channel_consensus: [],
        market_score: 50,
        overall_insight: "유튜브 영상을 불러오지 못했습니다.",
        updated_at: new Date().toISOString(),
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load(topic);
    const id = setInterval(() => load(topic), 300_000);
    return () => clearInterval(id);
  }, [load, topic]);

  useEffect(() => {
    const syncDetailSide = () => setDetailSide(window.innerWidth < 1024 ? "bottom" : "right");
    syncDetailSide();
    window.addEventListener("resize", syncDetailSide);
    return () => window.removeEventListener("resize", syncDetailSide);
  }, []);

  useEffect(() => {
    setSource("all");
  }, [topic, tier]);

  const topics = useMemo(() => payload?.topics || [{ id: "all", label: "전체" }], [payload]);
  const tierFilters = useMemo(() => payload?.tier_filters || [], [payload]);
  const sourceFilters = useMemo(() => payload?.source_filters || [], [payload]);
  const videos = payload?.videos || [];

  const filteredVideos = useMemo(() => {
    return videos.filter((article) => {
      if (tier !== "all" && article.tier !== tier) return false;
      if (source !== "all" && article.source !== source) return false;
      return true;
    });
  }, [source, tier, videos]);

  const cards = useMemo(() => summaryCards(filteredVideos, payload?.market_score ?? 50), [filteredVideos, payload?.market_score]);

  const filteredConsensus = useMemo(() => {
    if (!payload?.channel_consensus?.length) return [];
    if (tier === "all" && source === "all") return payload.channel_consensus;
    return payload.channel_consensus.filter((item) => {
      if (tier !== "all" && item.tier !== tier) return false;
      if (source !== "all" && item.source !== source) return false;
      return true;
    });
  }, [payload, source, tier]);

  useEffect(() => {
    if (filteredVideos.length === 0) {
      setSelected(null);
      setSheetOpen(false);
      return;
    }

    if (selected && !filteredVideos.some((item) => item.id === selected.id)) {
      setSelected(null);
      setSheetOpen(false);
    }
  }, [filteredVideos, selected]);

  const selectArticle = (article: NewsArticle) => {
    setSelected(article);
    setSheetOpen(true);
  };

  return (
    <div className="h-full overflow-hidden bg-[#0a0a0a] text-white">
      <ScrollArea className="h-full px-4 py-4 md:px-6 md:py-5">
        <div className="mx-auto flex max-w-[1680px] flex-col gap-5 pb-6">
          <Card className="rounded-2xl border border-[#1f1f1f] bg-[#111]">
            <CardContent className="flex flex-col gap-5 p-5 md:p-6">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-[#ff8833]">
                    <Sparkles size={18} />
                    <span className="text-lg font-semibold">AI 분석 인사이트</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[#777]">일반 뉴스 카드와 비슷한 톤으로 정리하고, 선택한 영상의 실제 내용 기준 핵심을 아래에서 바로 읽을 수 있게 만들었습니다.</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-white/40">업데이트 {payload ? formatTime(payload.updated_at) : "방금"}</div>
                  <button
                    onClick={() => load(topic)}
                    disabled={isLoading}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/70 transition hover:border-white/20 hover:text-white disabled:opacity-40"
                  >
                    <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
                    새로고침
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                {cards.map((card) => (
                  <MetricCard key={card.title} title={card.title} value={card.value} hint={card.hint} accent={card.accent} />
                ))}
              </div>

              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-2">
                  <div className="text-xs text-white/45">주제</div>
                  <div className="flex max-w-full flex-wrap gap-2">
                    {topics.map((item) => (
                      <FilterButton key={item.id} active={topic === item.id} label={item.label} onClick={() => setTopic(item.id)} />
                    ))}
                  </div>
                </div>

                <div className="grid flex-1 gap-3 md:grid-cols-2 xl:max-w-[760px]">
                  <div className="space-y-2">
                    <div className="text-xs text-white/45">레이어</div>
                    <div className="flex flex-wrap gap-2">
                      <FilterButton active={tier === "all"} label="전체" count={videos.length} onClick={() => setTier("all")} />
                      {tierFilters.map((item) => (
                        <FilterButton key={item.id} active={tier === item.id} label={item.label} count={item.count} onClick={() => setTier(item.id)} />
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs text-white/45">채널</div>
                    <div className="flex max-h-[90px] flex-wrap gap-2 overflow-auto pr-1">
                      <FilterButton active={source === "all"} label="전체" count={videos.length} onClick={() => setSource("all")} />
                      {sourceFilters.map((item) => (
                        <FilterButton key={item.id} active={source === item.id} label={item.label} count={item.count} onClick={() => setSource(item.id)} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {payload?.desk_guide?.layers?.length ? (
            <Card className="rounded-[30px] border-white/10 bg-white/[0.028]">
              <CardHeader>
                <div className="flex items-center gap-3 text-[#B4C2FF]">
                  <ShieldCheck size={18} />
                  <CardTitle>AI 투자 컨센서스 엔진용 유튜브 레이어</CardTitle>
                </div>
                <CardDescription>원천 데이터 → 전문가 해석 → 미래산업 순으로 읽게 구성했습니다.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 xl:grid-cols-3">
                  {payload.desk_guide.layers.map((layer) => (
                    <GuideLayerCard key={layer.id} layer={layer} />
                  ))}
                </div>
                {!!payload.desk_guide.excluded.length && (
                  <div className="rounded-[24px] border border-rose-300/10 bg-rose-300/[0.04] p-4">
                    <div className="text-sm font-medium text-rose-100">초기 서비스에서 제외하는 채널</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {payload.desk_guide.excluded.map((item) => (
                        <Badge key={item} className="border-rose-200/10 bg-black/10 text-rose-100/75">
                          {item}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}

          <div className="space-y-5">
            <Card className="rounded-2xl border border-[#1f1f1f] bg-[#111]">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2 text-white">
                  <BarChart3 size={16} className="text-[#9EF7CC]" />
                  <CardTitle>종합 인사이트</CardTitle>
                </div>
                <CardDescription>{payload?.overall_insight || "유튜브 영상을 불러오는 중입니다."}</CardDescription>
              </CardHeader>
            </Card>

            <Card className="rounded-2xl border border-[#1f1f1f] bg-[#111]">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle>뉴스 리스트</CardTitle>
                    <CardDescription>카드를 클릭하거나 터치하면 팝업으로 상세 분석을 열고, 평소에는 더 많은 리스트를 한 번에 볼 수 있습니다.</CardDescription>
                  </div>
                  <div className="text-xs text-white/40">총 {filteredVideos.length}건</div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading && filteredVideos.length === 0 ? (
                  <div className="flex h-[320px] items-center justify-center">
                    <div className="space-y-3 text-center">
                      <RefreshCw size={18} className="mx-auto animate-spin text-[#8EF3C5]" />
                      <div className="text-sm text-white/45">유튜브 영상과 인사이트를 정리하는 중...</div>
                    </div>
                  </div>
                ) : filteredVideos.length === 0 ? (
                  <div className="flex h-[320px] items-center justify-center text-sm text-white/45">현재 조건에 맞는 영상이 없습니다.</div>
                ) : (
                  <Virtuoso
                    style={{ height: 720 }}
                    totalCount={filteredVideos.length}
                    overscan={300}
                    itemContent={(index) => {
                      const article = filteredVideos[index];
                      return (
                        <div className="pb-3">
                          <VideoListCard article={article} active={selected?.id === article.id && sheetOpen} onSelect={selectArticle} />
                        </div>
                      );
                    }}
                  />
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-[#1f1f1f] bg-[#111]">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2 text-white">
                  <Tags size={16} className="text-[#B4C2FF]" />
                  <CardTitle>채널 컨센서스</CardTitle>
                </div>
                <CardDescription>현재 필터에서 같은 방향을 말하는 채널을 묶었습니다.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {filteredConsensus.length > 0 ? (
                  filteredConsensus.map((item) => <ConsensusRow key={`${item.source}-${item.stance}`} item={item} />)
                ) : (
                  <div className="text-sm text-white/45">현재 필터에 맞는 컨센서스가 없습니다.</div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </ScrollArea>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side={detailSide} className={cn(detailSide === "bottom" ? "border-t border-[#1f1f1f] bg-[#0b0b0b] p-0 text-white lg:hidden" : "w-full max-w-[760px] border-l border-[#1f1f1f] bg-[#0b0b0b] p-0 text-white")}>
          <SheetHeader className="border-b border-[#1f1f1f] px-5 py-4 text-left">
            <SheetTitle>{selected ? selected.title_ko || selected.title : "영상 인사이트"}</SheetTitle>
            <SheetDescription>
              {detailSide === "bottom" ? "모바일에서는 하단 시트로 상세 분석을 보여줍니다." : "카드를 클릭했을 때만 상세 분석 팝업이 열립니다."}
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4 pt-3">
            <DetailPanel article={selected} overallInsight={payload?.overall_insight} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
