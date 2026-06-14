import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus, RefreshCw, Activity } from "lucide-react";
import { motion } from "framer-motion";
import { marketApi, newsApi } from "@/api/client";
import type { VideoNewsResponse } from "@/types";

interface IndexCard {
  label: string;
  value: number | null;
  change: number | null;
  change_pct: number | null;
}

function fmt(v: number | null | undefined, decimals = 2): string {
  if (v == null || isNaN(v)) return "—";
  return v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function toKST(utcStr: string): string {
  try {
    const d = new Date(utcStr);
    return d.toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    }) + " KST";
  } catch { return utcStr; }
}

// VIX 기반 공포 레벨
function vixLabel(vix: number): { text: string; color: string } {
  if (vix < 15) return { text: "LOW FEAR", color: "text-terminal-green" };
  if (vix < 20) return { text: "CALM", color: "text-terminal-yellow" };
  if (vix < 30) return { text: "ELEVATED", color: "text-terminal-yellow" };
  if (vix < 40) return { text: "HIGH FEAR", color: "text-terminal-red" };
  return { text: "EXTREME FEAR", color: "text-terminal-red" };
}

// 변화율 → 시각적 강도 바 너비 (3% = 100%)
function changeMagnitude(pct: number | null): number {
  return Math.min(Math.abs(pct ?? 0) / 3 * 100, 100);
}

function MarketCard({ label, value, change, change_pct, index }: IndexCard & { index: number }) {
  const up   = (change_pct ?? 0) > 0;
  const down = (change_pct ?? 0) < 0;
  const isVix = label === "VIX";

  const accentClass = up ? "bg-terminal-green" : down ? "bg-terminal-red" : "bg-terminal-gray";
  const textClass   = up ? "text-terminal-green" : down ? "text-terminal-red" : "text-terminal-text-dim";
  const bgClass     = up ? "bg-terminal-green/5" : down ? "bg-terminal-red/5" : "";
  const Icon        = up ? TrendingUp : down ? TrendingDown : Minus;
  const magnitude   = changeMagnitude(change_pct);
  const vix         = isVix && value != null ? vixLabel(value) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
      className={`relative bg-terminal-panel border border-terminal-border rounded-xl overflow-hidden hover:border-terminal-accent/30 transition-colors ${bgClass}`}
    >
      {/* 왼쪽 색상 스트립 */}
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${accentClass}`} />

      <div className="pl-4 pr-3 pt-3 pb-2.5">
        {/* 라벨 + 아이콘 */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono text-terminal-text-dim uppercase tracking-wider">{label}</span>
          <Icon size={11} className={textClass} />
        </div>

        {/* 가격 */}
        <div className="text-sm font-mono font-bold text-terminal-text-primary mb-0.5">
          {value != null ? fmt(value) : "—"}
        </div>

        {/* VIX 특별 표시 */}
        {vix && (
          <div className={`text-[9px] font-mono font-bold tracking-widest mb-1 ${vix.color}`}>
            {vix.text}
          </div>
        )}

        {/* 변화율 */}
        <div className={`text-[11px] font-mono ${textClass} mb-2`}>
          {change_pct != null
            ? `${up ? "+" : ""}${change_pct.toFixed(2)}%`
            : "—"}
        </div>

        {/* 강도 바 */}
        <div className="h-[3px] bg-terminal-border rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${magnitude}%` }}
            transition={{ delay: index * 0.04 + 0.2, duration: 0.4, ease: "easeOut" }}
            className={`h-full rounded-full ${accentClass}`}
          />
        </div>
      </div>
    </motion.div>
  );
}

// 섹션 헤더
function SectionHeader({ emoji, label }: { emoji: string; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-sm">{emoji}</span>
      <span className="text-[10px] font-mono text-terminal-accent uppercase tracking-widest">{label}</span>
      <div className="flex-1 h-px bg-terminal-border" />
    </div>
  );
}

// 마켓 상태 표시기
function MarketStatusBadge({ label, open }: { label: string; open: boolean }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
      open
        ? "bg-terminal-green/5 border-terminal-green/20"
        : "bg-terminal-border/30 border-terminal-border"
    }`}>
      <span className={`w-2 h-2 rounded-full live-dot ${open ? "bg-terminal-green" : "bg-terminal-gray"}`} />
      <div>
        <div className={`text-[11px] font-mono font-semibold ${open ? "text-terminal-green" : "text-terminal-text-dim"}`}>
          {label}
        </div>
        <div className="text-[9px] font-mono text-terminal-text-dim">{open ? "개장 중" : "마감"}</div>
      </div>
    </div>
  );
}

function BriefChip({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "green" | "red" | "yellow" | "neutral" }) {
  const toneClass = {
    green: "border-terminal-green/30 bg-terminal-green/5 text-terminal-green",
    red: "border-terminal-red/30 bg-terminal-red/5 text-terminal-red",
    yellow: "border-terminal-yellow/30 bg-terminal-yellow/5 text-terminal-yellow",
    neutral: "border-terminal-border bg-terminal-bg/40 text-terminal-text-secondary",
  }[tone];

  return (
    <div className={`rounded-lg border px-3 py-2 ${toneClass}`}>
      <div className="text-[9px] font-mono uppercase tracking-wider opacity-70">{label}</div>
      <div className="mt-0.5 text-xs font-mono font-semibold">{value}</div>
    </div>
  );
}

function MarketBrief({
  mood,
  avgChange,
  vix,
  usdkrw,
  oil,
}: {
  mood: string;
  avgChange: number;
  vix?: IndexCard;
  usdkrw?: IndexCard;
  oil?: IndexCard;
}) {
  const riskTone = vix?.value == null ? "neutral" : vix.value >= 20 ? "red" : vix.value >= 15 ? "yellow" : "green";
  const riskText = vix?.value == null ? "확인 중" : vix.value >= 20 ? "변동성 주의" : vix.value >= 15 ? "보통" : "차분";
  const moodTone = avgChange > 0.3 ? "green" : avgChange < -0.3 ? "red" : "yellow";
  const fxTone = (usdkrw?.change_pct ?? 0) > 0.2 ? "yellow" : (usdkrw?.change_pct ?? 0) < -0.2 ? "green" : "neutral";
  const oilTone = (oil?.change_pct ?? 0) > 1 ? "yellow" : (oil?.change_pct ?? 0) < -1 ? "green" : "neutral";

  return (
    <div className="rounded-xl border border-terminal-border bg-terminal-panel p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[10px] font-mono text-terminal-accent uppercase tracking-widest">오늘 시장 체크</div>
          <div className="mt-1 text-xs text-terminal-text-dim">지수·환율·유가를 한 번에 묶어 지금 분위기를 보여줘요.</div>
        </div>
        <div className="text-[10px] font-mono text-terminal-text-dim">데이터 기준: 제공처 최근가/지연 가능</div>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <BriefChip label="시장 분위기" value={`${mood} ${avgChange >= 0 ? "+" : ""}${avgChange.toFixed(2)}%`} tone={moodTone} />
        <BriefChip label="위험 신호" value={riskText} tone={riskTone} />
        <BriefChip label="원/달러" value={usdkrw?.value == null ? "확인 중" : `${fmt(usdkrw.value, 0)}원`} tone={fxTone} />
        <BriefChip label="유가" value={oil?.value == null ? "확인 중" : `$${fmt(oil.value)}`} tone={oilTone} />
      </div>
    </div>
  );
}

// AI 인사이트 파서 (기존 유지)
function InsightBlock({ text }: { text: string }) {
  return (
    <div className="whitespace-pre-wrap text-xs font-mono text-terminal-text-secondary leading-relaxed">
      {text.split("\n").map((line, i) => {
        if (line.startsWith("[ ") && line.endsWith(" ]")) {
          return (
            <div key={i} className="mt-4 mb-1 text-[10px] font-mono text-terminal-accent uppercase tracking-widest">
              {line}
            </div>
          );
        }
        if (line.startsWith("  [")) {
          const match = line.match(/^\s+\[([^\]]+)\]\s*(.*)/);
          if (match) {
            return (
              <div key={i} className="flex gap-2 py-0.5 border-b border-terminal-border">
                <span className="text-[10px] font-mono text-terminal-text-dim shrink-0 w-28 truncate">{match[1]}</span>
                <span className="text-[10px] font-mono text-terminal-text-secondary">{match[2]}</span>
              </div>
            );
          }
        }
        if (line.startsWith("  ")) {
          return <div key={i} className="text-[10px] font-mono text-terminal-text-primary py-0.5">{line.trim()}</div>;
        }
        return <div key={i} className="text-xs font-mono text-terminal-text-secondary">{line}</div>;
      })}
    </div>
  );
}

export function HomePage() {
  const [indices, setIndices]         = useState<Record<string, any>>({});
  const [forex, setForex]             = useState<Record<string, any>>({});
  const [commodities, setCommodities] = useState<Record<string, any>>({});
  const [videoData, setVideoData]     = useState<VideoNewsResponse | null>(null);
  const [loading, setLoading]         = useState(true);
  const [insightLoading, setInsightLoading] = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [clock, setClock]             = useState(new Date());

  const loadMarket = async () => {
    const [idx, fx, com] = await Promise.all([
      marketApi.indices().catch(() => ({})),
      marketApi.forex().catch(() => ({})),
      marketApi.commodities().catch(() => ({})),
    ]);
    setIndices(idx); setForex(fx); setCommodities(com);
    setLoading(false);
  };

  const loadInsight = async () => {
    const data = await newsApi.videos("all", 30).catch(() => null);
    setVideoData(data);
    setInsightLoading(false);
  };

  useEffect(() => {
    loadMarket(); loadInsight();
    const marketId = setInterval(loadMarket, 60_000);
    const clockId  = setInterval(() => setClock(new Date()), 1000);
    return () => { clearInterval(marketId); clearInterval(clockId); };
  }, []);

  const handleRefreshInsight = async () => {
    setRefreshing(true);
    await loadInsight();
    setRefreshing(false);
  };

  const q = (obj: Record<string, any>, key: string): IndexCard => ({
    label: key,
    value: obj[key]?.price ?? null,
    change: obj[key]?.change ?? null,
    change_pct: obj[key]?.change_pct ?? null,
  });

  // 장 상태
  const kstHour = (clock.getUTCHours() + 9) % 24;
  const kstMin  = clock.getUTCMinutes();
  const krOpen  = kstHour >= 9 && (kstHour < 15 || (kstHour === 15 && kstMin < 30));
  const usHour  = (clock.getUTCHours() - 4 + 24) % 24; // EDT
  const usOpen  = usHour >= 9.5 && usHour < 16;

  // 카드 그룹
  const usCards   = ["NDX", "SPX", "DJIA", "VIX"].map((k) => q(indices, k)).filter((c) => c.value != null);
  const krCards   = ["KOSPI", "KOSDAQ"].map((k) => q(indices, k)).filter((c) => c.value != null);
  const fxCards   = ["USD/KRW", "JPY/KRW", "EUR/KRW"].map((k) => q(forex, k)).filter((c) => c.value != null);
  const comCards  = ["Gold", "Oil", "Silver"].map((k) => q(commodities, k)).filter((c) => c.value != null);

  // 전체 시장 분위기 (평균 변화율 기반)
  const allChanges = [...usCards, ...krCards].map((c) => c.change_pct ?? 0);
  const avgChange  = allChanges.length ? allChanges.reduce((a, b) => a + b, 0) / allChanges.length : 0;
  const marketMood = avgChange > 0.3 ? "강세" : avgChange < -0.3 ? "약세" : "혼조";
  const moodColor  = avgChange > 0.3 ? "text-terminal-green" : avgChange < -0.3 ? "text-terminal-red" : "text-terminal-yellow";

  const kstTime = clock.toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const vixCard = usCards.find((card) => card.label === "VIX");
  const usdkrwCard = fxCards.find((card) => card.label === "USD/KRW");
  const oilCard = comCards.find((card) => card.label === "Oil");

  return (
    <div className="h-full overflow-y-auto bg-terminal-bg">
      <div className="p-4 space-y-5 max-w-6xl mx-auto">

        {/* ── 상단 상태 바 ─────────────────────────────────── */}
        <div className="flex flex-wrap items-stretch gap-2">
          <MarketStatusBadge label="국내장" open={krOpen} />
          <MarketStatusBadge label="미국장" open={usOpen} />

          {/* 시장 분위기 뱃지 */}
          {!loading && allChanges.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-terminal-border bg-terminal-panel">
              <Activity size={12} className={moodColor} />
              <div>
                <div className={`text-[11px] font-mono font-semibold ${moodColor}`}>{marketMood}</div>
                <div className="text-[9px] font-mono text-terminal-text-dim">시장 분위기</div>
              </div>
            </div>
          )}

          {/* 시계 */}
          <div className="ml-auto flex items-center px-3 py-2 rounded-lg border border-terminal-border bg-terminal-panel">
            <div className="text-right">
              <div className="text-[11px] font-mono text-terminal-text-primary font-semibold">{kstTime}</div>
              <div className="text-[9px] font-mono text-terminal-text-dim">KST</div>
            </div>
          </div>
        </div>

        {!loading && (
          <MarketBrief
            mood={marketMood}
            avgChange={avgChange}
            vix={vixCard}
            usdkrw={usdkrwCard}
            oil={oilCard}
          />
        )}

        {/* ── 미국 지수 ──────────────────────────────────── */}
        {(loading || usCards.length > 0) && (
          <div>
            <SectionHeader emoji="🇺🇸" label="미국 지수" />
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-[90px] bg-terminal-panel border border-terminal-border rounded-xl animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {usCards.map((card, i) => <MarketCard key={card.label} {...card} index={i} />)}
              </div>
            )}
          </div>
        )}

        {/* ── 국내 지수 ──────────────────────────────────── */}
        {(loading || krCards.length > 0) && (
          <div>
            <SectionHeader emoji="🇰🇷" label="국내 지수" />
            {loading ? (
              <div className="grid grid-cols-2 gap-2">
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="h-[90px] bg-terminal-panel border border-terminal-border rounded-xl animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {krCards.map((card, i) => <MarketCard key={card.label} {...card} index={i} />)}
              </div>
            )}
          </div>
        )}

        {/* ── 환율 + 원자재 ──────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {(loading || fxCards.length > 0) && (
            <div>
              <SectionHeader emoji="💱" label="환율" />
              {loading ? (
                <div className="grid grid-cols-2 gap-2">
                  {[...Array(2)].map((_, i) => (
                    <div key={i} className="h-[90px] bg-terminal-panel border border-terminal-border rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {fxCards.map((card, i) => <MarketCard key={card.label} {...card} index={i} />)}
                </div>
              )}
            </div>
          )}

          {(loading || comCards.length > 0) && (
            <div>
              <SectionHeader emoji="🪙" label="원자재" />
              {loading ? (
                <div className="grid grid-cols-2 gap-2">
                  {[...Array(2)].map((_, i) => (
                    <div key={i} className="h-[90px] bg-terminal-panel border border-terminal-border rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {comCards.map((card, i) => <MarketCard key={card.label} {...card} index={i} />)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── AI 시장 인사이트 ────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <SectionHeader emoji="🤖" label="AI 시장 인사이트" />
            <div className="flex items-center gap-2 shrink-0 ml-2">
              {videoData?.updated_at && (
                <span className="text-[10px] font-mono text-terminal-text-dim">
                  {toKST(videoData.updated_at)}
                </span>
              )}
              <button
                type="button"
                onClick={handleRefreshInsight}
                disabled={refreshing || insightLoading}
                className="flex items-center gap-1 text-[10px] font-mono text-terminal-text-dim hover:text-terminal-accent border border-terminal-border rounded px-2 py-0.5 disabled:opacity-40 transition-colors"
              >
                <RefreshCw size={9} className={refreshing ? "animate-spin" : ""} />
                새로고침
              </button>
            </div>
          </div>

          <div className="bg-terminal-panel border border-terminal-border rounded-xl p-4 border-l-[3px] border-l-terminal-accent">
            {insightLoading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-3 bg-terminal-border rounded animate-pulse" style={{ width: `${70 + i * 5}%` }} />
                ))}
              </div>
            ) : videoData?.overall_insight ? (
              <InsightBlock text={videoData.overall_insight} />
            ) : (
              <div className="text-xs font-mono text-terminal-text-dim">인사이트를 불러올 수 없습니다.</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
