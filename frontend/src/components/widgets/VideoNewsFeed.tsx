import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, BarChart3, ExternalLink, Play, RefreshCw, ShieldCheck, Sparkles, Tags } from "lucide-react";
import { Virtuoso } from "react-virtuoso";
import { newsApi } from "@/api/client";
import type { ChannelConsensusItem, NewsArticle, VideoDeskGuideLayer, VideoNewsResponse } from "@/types";
import { ScrollArea } from "@/components/ui/scroll-area";
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
    return { label: "BULLISH", className: "border-green-500/30 bg-green-500/10 text-green-400" };
  }
  if (sentiment === "negative") {
    return { label: "BEARISH", className: "border-red-500/30 bg-red-500/10 text-red-400" };
  }
  return { label: "NEUTRAL", className: "border-[#444] bg-[#1a1a1a] text-[#888]" };
}

function tierTone(tier?: string) {
  if (tier === "s") return "border-sky-400/30 bg-sky-400/10 text-sky-300";
  if (tier === "a") return "border-amber-400/30 bg-amber-400/10 text-amber-300";
  return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
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
  if (article.investment_points?.length) return article.investment_points.slice(0, 4);
  const bullets = splitBullets(article.transcript_excerpt, article.insight);
  if (bullets.length > 0) return bullets.slice(0, 3);
  if (article.summary_ko || article.summary) return splitBullets(article.summary_ko, article.summary).slice(0, 3);
  return ["제목 기준으로 시장 관련성을 확인했습니다.", "영상 열기 버튼으로 원문 내용을 함께 확인해 주세요."];
}

function buildRiskBullets(article: NewsArticle) {
  if (article.risk_points?.length) return article.risk_points.slice(0, 3);
  if (!article.transcript_available && article.content_basis !== "video_ai") {
    return ["자막을 못 가져온 영상이라 실제 발언과 다를 수 있습니다. 원문 영상을 꼭 같이 확인하세요."];
  }
  return ["영상 하나만으로 매수·매도 결정을 내리지 말고 가격, 거래량, 다른 뉴스까지 함께 확인하세요."];
}

function summaryCards(videos: NewsArticle[], marketScore: number) {
  const bullish = videos.filter((item) => item.sentiment === "positive").length;
  const bearish = videos.filter((item) => item.sentiment === "negative").length;
  const neutral = videos.length - bullish - bearish;
  return [
    { title: "시장 온도", value: `${marketScore}점`, hint: "영상 톤·중요도 반영 체감 점수", accent: "text-[#FFD27D]" },
    { title: "상승 시각", value: `${bullish}건`, hint: "긍정적으로 해석한 채널", accent: "text-[#4ade80]" },
    { title: "하락 경계", value: `${bearish}건`, hint: "리스크를 강조한 채널", accent: "text-[#f87171]" },
    { title: "중립/관망", value: `${neutral}건`, hint: "팩트 확인 또는 방향성 대기", accent: "text-[#94a3b8]" },
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
        "inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-mono transition",
        active
          ? "border-[#ff6600]/40 bg-[#ff6600]/10 text-[#ff8833]"
          : "border-[#222] bg-transparent text-[#666] hover:border-[#333] hover:text-[#aaa]",
      )}
    >
      <span>{label}</span>
      {typeof count === "number" && <span className="text-[10px] opacity-60">{count}</span>}
    </button>
  );
}

function MetricCard({ title, value, hint, accent }: { title: string; value: string; hint: string; accent: string }) {
  return (
    <div className="rounded-xl border border-[#222] bg-[#0d0d0d] p-3">
      <div className="text-[10px] font-mono text-[#555]">{title}</div>
      <div className={cn("mt-1 text-xl font-bold", accent)}>{value}</div>
      <div className="mt-1 text-[10px] font-mono text-[#444]">{hint}</div>
    </div>
  );
}

function GuideLayerCard({ layer }: { layer: VideoDeskGuideLayer }) {
  return (
    <div className="rounded-xl border border-[#222] bg-[#0d0d0d] p-3">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="text-sm font-medium text-[#ddd]">{layer.label}</div>
        <span className={cn("px-1.5 py-0.5 text-[10px] font-mono rounded border", tierTone(layer.tier))}>
          {layer.tier.toUpperCase()}
        </span>
      </div>
      <div className="text-xs text-[#555] mb-3">{layer.description}</div>
      <div className="flex flex-wrap gap-1.5">
        {layer.sources.map((source) => (
          <span key={source} className="text-[10px] font-mono text-[#666] border border-[#222] bg-[#161616] px-1.5 py-0.5 rounded">
            {source}
          </span>
        ))}
      </div>
    </div>
  );
}

function ConsensusRow({ item }: { item: ChannelConsensusItem }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[#222] bg-[#111] px-3 py-2.5 hover:border-[#333] transition">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-[#ddd]">{item.source}</div>
        <div className="truncate text-[10px] font-mono text-[#555]">{item.tier_label || item.layer_label || "시장 해석"}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-xs font-mono font-semibold text-[#4ade80]">{item.stance}</div>
        <div className="text-[10px] font-mono text-[#555]">{item.count}건</div>
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
  const tags = (article.tags || []).slice(0, 4);
  const tickers = (article.tickers || []).slice(0, 3);

  return (
    <motion.button
      layout
      whileHover={{ y: -1 }}
      onClick={() => onSelect(article)}
      className={cn(
        "group relative w-full rounded-xl border p-3 text-left transition duration-200",
        active
          ? "border-[#ff6600]/40 bg-[#151515]"
          : "border-[#222] bg-[#111] hover:border-[#333] hover:bg-[#151515]",
      )}
    >
      {active && (
        <div className="pointer-events-none absolute -right-3 top-1/2 hidden -translate-y-1/2 rounded border border-[#ff6600]/30 bg-[#ff6600]/10 p-1.5 text-[#ff8833] lg:flex">
          <ArrowRight size={12} />
        </div>
      )}
      <div className="flex gap-3">
        <div className="relative h-[68px] w-[100px] shrink-0 overflow-hidden rounded-lg border border-[#1f1f1f] bg-[#0a0a0a]">
          <img
            src={article.video_thumbnail || article.image || "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg"}
            alt={article.title}
            className="h-full w-full object-cover opacity-85 group-hover:opacity-95 transition-opacity"
            loading="lazy"
          />
          <div className="absolute bottom-1 left-1 inline-flex items-center gap-0.5 rounded bg-black/50 px-1.5 py-0.5 text-[9px] font-mono text-white/80">
            <Play size={8} fill="currentColor" />
            영상
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-mono text-[#ff8833]">{article.source}</span>
              <span className="text-[#333]">·</span>
              <span className="text-[10px] font-mono text-[#555]">{formatTime(article.published_at)}</span>
            </div>
            <span className={cn("shrink-0 text-[10px] font-mono rounded border px-1.5 py-0.5", sentiment.className)}>
              {sentiment.label}
            </span>
          </div>

          <div className="text-sm font-medium text-[#ededed] leading-snug line-clamp-2 mb-1.5">
            {article.title_ko || article.title}
          </div>

          <div className="mb-2 line-clamp-2 text-xs leading-5 text-[#9a9a9a]">
            {(article.investment_points?.[0] || article.insight || article.summary_ko || article.summary || "").replace(/^제목·설명 기준으로 보면 핵심은 /, "")}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {tickers.map((t) => (
              <span key={t} className="text-[10px] font-mono text-[#3399ff] bg-[#3399ff]/10 border border-[#3399ff]/20 px-1.5 py-0.5 rounded">
                ${t}
              </span>
            ))}
            {article.tier_label && (
              <span className={cn("text-[10px] font-mono rounded border px-1.5 py-0.5", tierTone(article.tier))}>
                {article.tier_label}
              </span>
            )}
            {tags.map((tag) => (
              <span key={tag} className="text-[10px] font-mono text-[#555] border border-[#222] bg-[#161616] px-1.5 py-0.5 rounded">
                #{tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </motion.button>
  );
}

function DetailPanel({ article, overallInsight }: { article: NewsArticle | null; overallInsight?: string }) {
  if (!article) {
    return (
      <div className="flex h-full min-h-[360px] items-center justify-center rounded-xl border border-dashed border-[#222] bg-[#111]">
        <div className="text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded border border-[#222] bg-[#161616]">
            <Sparkles size={15} className="text-[#ff8833]" />
          </div>
          <div className="text-sm font-medium text-[#aaa]">영상을 선택하세요</div>
          <p className="mt-1 text-xs font-mono text-[#555]">리스트에서 영상을 고르면 분석을 표시합니다.</p>
        </div>
      </div>
    );
  }

  const sentiment = getSentimentMeta(article.sentiment);
  const bullets = splitBullets(article.transcript_excerpt, article.insight, overallInsight);
  const actionBullets = buildActionBullets(article);
  const riskBullets = buildRiskBullets(article);
  const tags = article.tags || [];
  const tickers = article.tickers || [];
  const hasVideoContent = article.transcript_available || article.content_basis === "video_ai";

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={article.id}
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -8 }}
        transition={{ duration: 0.18 }}
        className="h-full"
      >
        <div className="h-full rounded-xl border border-[#222] bg-[#111] overflow-hidden">
          <ScrollArea className="h-full max-h-[calc(100vh-190px)] lg:max-h-[calc(100vh-170px)]">
            <div className="p-4 space-y-3">

              {/* 헤더: 썸네일 + 제목 + 감성 */}
              <div className="flex items-start gap-3">
                <div className="h-[64px] w-[92px] shrink-0 overflow-hidden rounded-lg border border-[#1f1f1f] bg-[#0a0a0a]">
                  <img
                    src={article.video_thumbnail || article.image || "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg"}
                    alt={article.title}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                    <span className={cn("text-[10px] font-mono rounded border px-1.5 py-0.5", sentiment.className)}>
                      {sentiment.label}
                    </span>
                    <span className="text-[10px] font-mono text-[#ff8833]">{article.source}</span>
                    <span className="text-[10px] font-mono text-[#555]">{formatDate(article.published_at)}</span>
                    <span className="text-[10px] font-mono text-[#444]">{formatTime(article.published_at)}</span>
                  </div>
                  <div className="text-sm font-medium text-[#ddd] leading-5 line-clamp-3">
                    {article.title_ko || article.title}
                  </div>
                </div>
              </div>

              {/* 관련 종목 티커 */}
              {tickers.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-mono text-[#444]">관련종목</span>
                  {tickers.map((t) => (
                    <span key={t} className="text-[10px] font-mono text-[#3399ff] bg-[#3399ff]/10 border border-[#3399ff]/30 px-1.5 py-0.5 rounded">
                      ${t}
                    </span>
                  ))}
                </div>
              )}

              {/* 분류 배지 */}
              <div className="flex flex-wrap gap-1.5">
                {article.tier_label && (
                  <span className={cn("text-[10px] font-mono rounded border px-1.5 py-0.5", tierTone(article.tier))}>
                    {article.tier_label}
                  </span>
                )}
                {article.layer_label && (
                  <span className="text-[10px] font-mono text-[#666] border border-[#222] bg-[#161616] px-1.5 py-0.5 rounded">
                    {article.layer_label}
                  </span>
                )}
                {article.region_label && (
                  <span className="text-[10px] font-mono text-[#7899b4] border border-[#2a2a2a] bg-[#131313] px-1.5 py-0.5 rounded">
                    {article.region_label}
                  </span>
                )}
                {article.topic_label && (
                  <span className="text-[10px] font-mono text-[#7bd389] border border-[#7bd389]/20 bg-[#7bd389]/5 px-1.5 py-0.5 rounded">
                    {article.topic_label}
                  </span>
                )}
                <span className={cn(
                  "text-[10px] font-mono rounded border px-1.5 py-0.5",
                  hasVideoContent
                    ? "border-emerald-400/30 bg-emerald-400/5 text-emerald-400"
                    : "border-[#333] bg-[#1a1a1a] text-[#555]"
                )}>
                  {article.transcript_available ? "자막 기반" : article.content_basis === "video_ai" ? "영상 AI" : "제목 기준"}
                </span>
              </div>

              {/* 핵심 요약 */}
              <div className="rounded-xl border border-[#1a1a1a] bg-[#0d0d0d] p-3">
                <div className="text-[10px] font-mono text-[#ff8833] mb-2">[ 영상 핵심 ]</div>
                <p className="text-[13px] leading-6 text-[#ccc]">
                  {article.insight || overallInsight || "분석 요약을 준비 중입니다."}
                </p>
                {hasVideoContent && bullets.length > 0 && (
                  <ul className="mt-3 space-y-2 border-t border-[#1a1a1a] pt-3">
                    {bullets.map((bullet) => (
                      <li key={bullet} className="flex gap-2 text-xs leading-5 text-[#999]">
                        <span className="text-[#444] mt-0.5 shrink-0">▸</span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {!hasVideoContent && (
                  <div className="mt-2 pt-2 border-t border-[#1a1a1a] text-[10px] font-mono text-[#444]">
                    자막 미확보 — 제목·설명 기준 분석입니다
                  </div>
                )}
              </div>

              {/* 투자 체크포인트 */}
              <div className="rounded-xl border border-[#1a1a1a] bg-[#0d0d0d] p-3">
                <div className="text-[10px] font-mono text-[#aaa] mb-2">[ 투자 체크포인트 ]</div>
                <ul className="space-y-2">
                  {actionBullets.map((bullet) => (
                    <li key={bullet} className="flex gap-2 text-xs leading-5 text-[#ccc]">
                      <span className="text-[#ff8833] mt-0.5 shrink-0">•</span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 pt-2 border-t border-[#1a1a1a] text-[10px] font-mono text-[#444]">
                  출처 관점: {article.source_role || article.layer_label || "전문가 해설"} | 매매 전 원문 확인 필수
                </div>
              </div>

              {/* 리스크 체크 */}
              <div className="rounded-xl border border-red-500/10 bg-red-500/[0.03] p-3">
                <div className="text-[10px] font-mono text-red-300/80 mb-2">[ 조심할 점 ]</div>
                <ul className="space-y-2">
                  {riskBullets.map((bullet) => (
                    <li key={bullet} className="flex gap-2 text-xs leading-5 text-[#b8b8b8]">
                      <span className="text-red-400/70 mt-0.5 shrink-0">!</span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 태그 + 링크 */}
              <div className="space-y-2">
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {tags.slice(0, 10).map((tag) => (
                      <span key={tag} className="text-[10px] font-mono text-[#555] border border-[#222] bg-[#161616] px-1.5 py-0.5 rounded">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded border border-[#222] bg-[#111] px-3 py-1.5 text-xs font-mono text-[#aaa] transition hover:border-[#333] hover:text-white"
                  >
                    <ExternalLink size={11} />
                    원문
                  </a>
                  <a
                    href={article.video_url || article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded border border-[#ff6600]/25 bg-[#ff6600]/10 px-3 py-1.5 text-xs font-mono text-[#ff8833] transition hover:bg-[#ff6600]/15"
                  >
                    <Play size={11} />
                    영상 열기
                  </a>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function InsightDashboard({
  videos,
  selected,
  overallInsight,
  marketScore,
  onSelect,
}: {
  videos: NewsArticle[];
  selected: NewsArticle | null;
  overallInsight?: string;
  marketScore: number;
  onSelect: (article: NewsArticle) => void;
}) {
  const active = selected || videos[0] || null;
  const contentReady = videos.filter((item) => item.transcript_available || item.content_basis === "video_ai").length;
  const bullish = videos.filter((item) => item.sentiment === "positive").length;
  const bearish = videos.filter((item) => item.sentiment === "negative").length;
  const neutral = Math.max(videos.length - bullish - bearish, 0);
  const topicRows = Object.entries(
    videos.reduce<Record<string, number>>((acc, item) => {
      const label = item.topic_label || "기타";
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const coveragePct = videos.length ? Math.round((contentReady / videos.length) * 100) : 0;
  const activeBullets = active ? splitBullets(active.insight, active.transcript_excerpt, active.summary_ko, active.summary).slice(0, 3) : [];

  return (
    <div className="rounded-xl border border-[#222] bg-[#111] overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1a1a1a]">
        <BarChart3 size={13} className="text-[#ff8833]" />
        <span className="text-xs font-mono text-[#aaa]">AI 인사이트 대시보드</span>
        <span className="ml-auto text-[10px] font-mono text-[#444]">MARKET SCORE</span>
        <span className="text-sm font-bold text-[#FFD27D] font-mono">{marketScore}</span>
      </div>

      <div className="p-3 grid gap-3 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-3">
          <p className="text-xs leading-5 text-[#666]">
            {overallInsight || "유튜브 영상의 주제, 시장 톤, 실제 내용 확보율을 한 화면에서 보여줍니다."}
          </p>

          <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
            {[
              { label: "분석 영상", value: `${videos.length}개`, sub: "필터 반영", color: "text-[#ddd]" },
              { label: "내용 확보", value: `${contentReady}개`, sub: `${coveragePct}%`, color: "text-[#4ade80]" },
              { label: "긍정/부정", value: `${bullish}/${bearish}`, sub: `중립 ${neutral}`, color: "text-[#94a3b8]" },
              { label: "선택 채널", value: active ? active.source : "없음", sub: active?.topic_label || "카드를 선택", color: "text-[#ff8833]" },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-[#1a1a1a] bg-[#0d0d0d] p-2.5">
                <div className="text-[10px] font-mono text-[#444]">{item.label}</div>
                <div className={`mt-1 truncate text-base font-bold ${item.color}`}>{item.value}</div>
                <div className="mt-0.5 text-[10px] font-mono text-[#555]">{item.sub}</div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-[#1a1a1a] bg-[#0d0d0d] p-2.5">
            <div className="flex items-center justify-between text-[10px] font-mono text-[#555] mb-1.5">
              <span>영상 내용 확보율</span>
              <span>{coveragePct}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[#1a1a1a]">
              <div className="h-full rounded-full bg-gradient-to-r from-[#ff6600] to-[#FFD27D]" style={{ width: `${coveragePct}%` }} />
            </div>
            <p className="mt-1.5 text-[10px] font-mono text-[#444]">
              자막·AI 확보 영상은 실제 내용 기반, 나머지는 제목·설명 기준으로 구분합니다.
            </p>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-1">
          <div className="rounded-xl border border-[#1a1a1a] bg-[#0d0d0d] p-3">
            <div className="text-[10px] font-mono text-[#555] mb-2">분야 분포</div>
            <div className="space-y-2">
              {topicRows.length > 0 ? topicRows.map(([label, count]) => {
                const pct = videos.length ? Math.round((count / videos.length) * 100) : 0;
                return (
                  <div key={label}>
                    <div className="flex items-center justify-between text-[10px] font-mono text-[#666] mb-1">
                      <span>{label}</span>
                      <span>{count}개</span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-[#1a1a1a]">
                      <div className="h-full rounded-full bg-[#ff8833]" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              }) : <div className="text-[10px] font-mono text-[#444]">분야 데이터가 없습니다.</div>}
            </div>
          </div>

          <div className="rounded-xl border border-[#222] bg-[#111] p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="text-[10px] font-mono text-[#ff8833]">선택 영상 핵심</div>
              {active && (
                <button type="button" onClick={() => onSelect(active)} className="text-[10px] font-mono text-[#666] hover:text-[#aaa] transition">
                  상세 열기 →
                </button>
              )}
            </div>
            {active ? (
              <div className="space-y-2">
                <div className="line-clamp-2 text-xs font-medium leading-5 text-[#ddd]">{active.title_ko || active.title}</div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[10px] font-mono text-[#777] border border-[#222] bg-[#161616] px-1.5 py-0.5 rounded">{active.source}</span>
                  <span className={cn(
                    "text-[10px] font-mono rounded border px-1.5 py-0.5",
                    active.transcript_available || active.content_basis === "video_ai"
                      ? "border-emerald-400/30 bg-emerald-400/5 text-emerald-400"
                      : "border-[#333] bg-[#1a1a1a] text-[#555]"
                  )}>
                    {active.transcript_available ? "자막" : active.content_basis === "video_ai" ? "영상AI" : "제목기준"}
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {(activeBullets.length ? activeBullets : [active.insight || active.summary_ko || active.summary || "요약 준비 중"]).map((bullet) => (
                    <li key={bullet} className="flex gap-1.5 text-[11px] leading-5 text-[#888]">
                      <span className="text-[#ff8833] shrink-0">•</span>
                      <span className="line-clamp-2">{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="text-[10px] font-mono text-[#444]">영상을 불러오면 핵심 요약을 표시합니다.</div>
            )}
          </div>
        </div>
      </div>
    </div>
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
    if (!selected) {
      setSelected(filteredVideos[0]);
      return;
    }
    if (!filteredVideos.some((item) => item.id === selected.id)) {
      setSelected(filteredVideos[0]);
      setSheetOpen(false);
    }
  }, [filteredVideos, selected]);

  const selectArticle = (article: NewsArticle) => {
    setSelected(article);
    setSheetOpen(true);
  };

  return (
    <div className="h-full overflow-hidden bg-[#0a0a0a] text-white">
      <ScrollArea className="h-full px-4 py-3 md:px-5 md:py-4">
        <div className="mx-auto flex max-w-[1680px] flex-col gap-4 pb-6">

          {/* 헤더 + 필터 */}
          <div className="rounded-xl border border-[#222] bg-[#111] overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1a1a1a]">
              <Sparkles size={13} className="text-[#ff8833]" />
              <span className="text-xs font-mono text-[#aaa]">유튜브 뉴스 인사이트</span>
              <span className="ml-auto text-[10px] font-mono text-[#444]">
                업데이트 {payload ? formatTime(payload.updated_at) : "방금"}
              </span>
              <button
                onClick={() => load(topic)}
                disabled={isLoading}
                className="inline-flex items-center gap-1 rounded border border-[#222] bg-transparent px-2 py-0.5 text-[10px] font-mono text-[#666] transition hover:border-[#333] hover:text-[#aaa] disabled:opacity-40"
              >
                <RefreshCw size={10} className={isLoading ? "animate-spin" : ""} />
                새로고침
              </button>
            </div>

            <div className="p-3 space-y-3">
              {/* 메트릭 카드 */}
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {cards.map((card) => (
                  <MetricCard key={card.title} title={card.title} value={card.value} hint={card.hint} accent={card.accent} />
                ))}
              </div>

              {/* 주제 필터 */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-mono text-[#444]">주제</div>
                <div className="flex flex-wrap gap-1.5">
                  {topics.map((item) => (
                    <FilterButton key={item.id} active={topic === item.id} label={item.label} onClick={() => setTopic(item.id)} />
                  ))}
                </div>
              </div>

              {/* 레이어 + 채널 필터 */}
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono text-[#444]">레이어</div>
                  <div className="flex flex-wrap gap-1.5">
                    <FilterButton active={tier === "all"} label="전체" count={videos.length} onClick={() => setTier("all")} />
                    {tierFilters.map((item) => (
                      <FilterButton key={item.id} active={tier === item.id} label={item.label} count={item.count} onClick={() => setTier(item.id)} />
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono text-[#444]">채널</div>
                  <div className="flex max-h-[72px] flex-wrap gap-1.5 overflow-auto pr-1">
                    <FilterButton active={source === "all"} label="전체" count={videos.length} onClick={() => setSource("all")} />
                    {sourceFilters.map((item) => (
                      <FilterButton key={item.id} active={source === item.id} label={item.label} count={item.count} onClick={() => setSource(item.id)} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <InsightDashboard
            videos={filteredVideos}
            selected={selected}
            overallInsight={payload?.overall_insight}
            marketScore={payload?.market_score ?? 50}
            onSelect={selectArticle}
          />

          {/* 레이어 가이드 */}
          {payload?.desk_guide?.layers?.length ? (
            <div className="rounded-xl border border-[#222] bg-[#111] overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1a1a1a]">
                <ShieldCheck size={13} className="text-[#94a3b8]" />
                <span className="text-xs font-mono text-[#888]">AI 투자 컨센서스 유튜브 레이어</span>
              </div>
              <div className="p-3 space-y-3">
                <p className="text-[10px] font-mono text-[#444]">원천 데이터 → 전문가 해석 → 미래산업 순으로 읽게 구성했습니다.</p>
                <div className="grid gap-2 xl:grid-cols-3">
                  {payload.desk_guide.layers.map((layer) => (
                    <GuideLayerCard key={layer.id} layer={layer} />
                  ))}
                </div>
                {!!payload.desk_guide.excluded.length && (
                  <div className="rounded-xl border border-red-500/15 bg-red-500/5 p-3">
                    <div className="text-[10px] font-mono text-red-400 mb-2">초기 서비스 제외 채널</div>
                    <div className="flex flex-wrap gap-1.5">
                      {payload.desk_guide.excluded.map((item) => (
                        <span key={item} className="text-[10px] font-mono text-[#666] border border-[#222] bg-[#161616] px-1.5 py-0.5 rounded">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {/* 뉴스 리스트 + 채널 컨센서스 */}
          <div className="space-y-4">
            <div className="rounded-xl border border-[#222] bg-[#111] overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1a1a1a]">
                <span className="text-xs font-mono text-[#888]">뉴스 리스트</span>
                <span className="ml-auto text-[10px] font-mono text-[#444]">총 {filteredVideos.length}건</span>
              </div>
              <div className="p-3">
                {isLoading && filteredVideos.length === 0 ? (
                  <div className="flex h-[280px] items-center justify-center">
                    <div className="text-center space-y-2">
                      <RefreshCw size={16} className="mx-auto animate-spin text-[#ff8833]" />
                      <div className="text-[10px] font-mono text-[#555]">유튜브 영상 인사이트 정리 중...</div>
                    </div>
                  </div>
                ) : filteredVideos.length === 0 ? (
                  <div className="flex h-[280px] items-center justify-center text-[10px] font-mono text-[#444]">
                    현재 조건에 맞는 영상이 없습니다.
                  </div>
                ) : (
                  <Virtuoso
                    style={{ height: 680 }}
                    totalCount={filteredVideos.length}
                    overscan={300}
                    itemContent={(index) => {
                      const article = filteredVideos[index];
                      return (
                        <div className="pb-2">
                          <VideoListCard article={article} active={selected?.id === article.id && sheetOpen} onSelect={selectArticle} />
                        </div>
                      );
                    }}
                  />
                )}
              </div>
            </div>

            <div className="rounded-xl border border-[#222] bg-[#111] overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1a1a1a]">
                <Tags size={12} className="text-[#94a3b8]" />
                <span className="text-xs font-mono text-[#888]">채널 컨센서스</span>
              </div>
              <div className="p-3 space-y-2">
                {filteredConsensus.length > 0 ? (
                  filteredConsensus.map((item) => <ConsensusRow key={`${item.source}-${item.stance}`} item={item} />)
                ) : (
                  <div className="text-[10px] font-mono text-[#444] py-2">현재 필터에 맞는 컨센서스가 없습니다.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side={detailSide}
          className={cn(
            "border-[#1f1f1f] bg-[#0b0b0b] p-0 text-white",
            detailSide === "bottom" ? "lg:hidden" : "w-full max-w-[680px] border-l",
          )}
        >
          <SheetHeader className="border-b border-[#1a1a1a] px-4 py-3 text-left">
            <SheetTitle className="text-sm font-medium text-[#ddd]">
              {selected ? selected.title_ko || selected.title : "영상 인사이트"}
            </SheetTitle>
            <SheetDescription className="text-[10px] font-mono text-[#444]">
              {selected ? `${selected.source} · ${formatTime(selected.published_at)}` : "카드를 클릭하면 분석 팝업이 열립니다."}
            </SheetDescription>
          </SheetHeader>
          <div className="px-3 pb-4 pt-3">
            <DetailPanel article={selected} overallInsight={payload?.overall_insight} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
