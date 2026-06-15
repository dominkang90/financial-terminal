import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus, RefreshCw, Activity, Search, Newspaper, Bell, Bot, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
import { marketApi, newsApi } from "@/api/client";
import { useSettingsStore } from "@/store/settingsStore";
import type { DataStatus, TabId, VideoNewsResponse } from "@/types";

interface IndexCard {
  label: string;
  value: number | null;
  change: number | null;
  change_pct: number | null;
  data_status?: DataStatus;
  data_quality_warning?: string;
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

function MarketCard({ label, value, change, change_pct, data_quality_warning, index }: IndexCard & { index: number }) {
  const unreliable = Boolean(data_quality_warning);
  const up   = !unreliable && (change_pct ?? 0) > 0;
  const down = !unreliable && (change_pct ?? 0) < 0;
  const isVix = label === "VIX";

  const accentClass = up ? "bg-terminal-green" : down ? "bg-terminal-red" : "bg-terminal-gray";
  const textClass   = up ? "text-terminal-green" : down ? "text-terminal-red" : "text-terminal-text-dim";
  const bgClass     = up ? "bg-terminal-green/5" : down ? "bg-terminal-red/5" : "";
  const Icon        = up ? TrendingUp : down ? TrendingDown : Minus;
  const magnitude   = unreliable ? 0 : changeMagnitude(change_pct);
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
          {unreliable ? "확인 필요" : value != null ? fmt(value) : "—"}
        </div>

        {unreliable && (
          <div className="mb-1 text-[9px] font-mono text-terminal-yellow" title={data_quality_warning}>
            제공처 재확인 필요
          </div>
        )}

        {/* VIX 특별 표시 */}
        {vix && (
          <div className={`text-[9px] font-mono font-bold tracking-widest mb-1 ${vix.color}`}>
            {vix.text}
          </div>
        )}

        {/* 변화율 */}
        <div className={`text-[11px] font-mono ${textClass} mb-2`}>
          {unreliable
            ? "숫자 재확인 중"
            : change_pct != null
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

function TrustNote() {
  const notes = [
    "숫자는 제공처 최근가라 지연될 수 있어요.",
    "값이나 변동률이 평소 범위를 벗어나면 확인 필요로 낮춰 보여줘요.",
    "뉴스/영상 요약은 원문 제목·내용·자막 여부를 기준으로 나눠 보여줘요.",
    "AI 설명은 참고용이에요. 매수·매도 결정은 스스로 확인해야 해요.",
  ];

  return (
    <div className="rounded-xl border border-terminal-border bg-terminal-panel p-3">
      <div className="mb-2 text-[10px] font-mono text-terminal-accent uppercase tracking-widest">믿고 보기 위한 안내</div>
      <div className="grid gap-2 md:grid-cols-4">
        {notes.map((note) => (
          <div key={note} className="rounded-lg border border-terminal-border bg-terminal-bg/35 px-3 py-2 text-[11px] leading-5 text-terminal-text-secondary">
            {note}
          </div>
        ))}
      </div>
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

function FriendlyGuide({ onTabChange, beginnerMode }: { onTabChange: (tab: TabId) => void; beginnerMode: boolean }) {
  const actions: Array<{ label: string; desc: string; tab: TabId; icon: typeof Search }> = [
    { label: "종목 보기", desc: "주가·차트부터 확인", tab: "markets", icon: Search },
    { label: "뉴스 읽기", desc: "오늘 이슈 빠르게 보기", tab: "news", icon: Newspaper },
    { label: "감시판 만들기", desc: "가격 알림 준비하기", tab: "monitor", icon: Bell },
    { label: "AI에게 묻기", desc: "어려운 내용 풀어보기", tab: "ai", icon: Bot },
  ];

  const baseTerms = [
    { word: "VIX", meaning: "시장이 얼마나 불안한지 보는 온도계예요." },
    { word: "원/달러", meaning: "달러 1개를 사는 데 필요한 원화 가격이에요." },
    { word: "지수", meaning: "여러 종목을 묶어 시장 전체 흐름을 보는 숫자예요." },
    { word: "최근가", meaning: "제공처가 마지막으로 알려준 가격이에요. 실시간이 아닐 수 있어요." },
  ];
  const beginnerTerms = [
    { word: "PER", meaning: "회사 이익에 비해 주가가 비싼지 보는 숫자예요." },
    { word: "PBR", meaning: "회사가 가진 자산에 비해 주가가 비싼지 보는 숫자예요." },
    { word: "EPS", meaning: "주식 1주가 벌어들인 회사 이익이에요." },
    { word: "시총", meaning: "주가에 전체 주식 수를 곱한 회사 크기예요." },
  ];
  const terms = beginnerMode ? [...baseTerms, ...beginnerTerms] : baseTerms;

  return (
    <div className="rounded-xl border border-terminal-accent/25 bg-gradient-to-br from-terminal-panel to-terminal-bg p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:justify-between">
        <div className="min-w-0 lg:w-5/12">
          <div className="text-[10px] font-mono text-terminal-accent uppercase tracking-widest">처음 오셨나요?</div>
          <h1 className="mt-2 text-lg font-semibold text-terminal-text-primary">오늘은 여기서 시작하면 돼요</h1>
          <div className={`mt-2 inline-flex rounded-full border px-2 py-1 text-[10px] font-mono ${beginnerMode ? "border-terminal-accent/40 bg-terminal-accent/10 text-terminal-accent" : "border-terminal-border text-terminal-text-dim"}`}>
            초보자 모드 {beginnerMode ? "켜짐" : "꺼짐"}
          </div>
          <p className="mt-2 text-sm leading-6 text-terminal-text-secondary">
            어려운 말은 줄이고, 오늘 꼭 볼 것만 먼저 보여드릴게요. 아래 버튼 하나만 눌러도 다음 화면으로 갈 수 있어요.
          </p>
        </div>

        <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
          {actions.map(({ label, desc, tab, icon: Icon }) => (
            <button
              key={tab}
              type="button"
              onClick={() => onTabChange(tab)}
              className="group rounded-lg border border-terminal-border bg-terminal-bg/40 p-3 text-left transition hover:border-terminal-accent/60 hover:bg-terminal-accent/5"
            >
              <div className="mb-2 flex items-center gap-2 text-terminal-text-primary">
                <Icon size={14} className="text-terminal-accent" />
                <span className="text-xs font-semibold">{label}</span>
              </div>
              <div className="text-[11px] leading-4 text-terminal-text-dim group-hover:text-terminal-text-secondary">{desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-4">
        {terms.map((term) => (
          <div key={term.word} className="rounded-lg border border-terminal-border bg-terminal-bg/30 px-3 py-2">
            <div className="text-[10px] font-mono font-semibold text-terminal-yellow">{term.word}</div>
            <div className="mt-1 text-[11px] leading-4 text-terminal-text-dim">{term.meaning}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TodayThreeLines({
  avgChange,
  vix,
  usdkrw,
  videoData,
}: {
  avgChange: number;
  vix?: IndexCard;
  usdkrw?: IndexCard;
  videoData: VideoNewsResponse | null;
}) {
  const marketLine = avgChange > 0.3
    ? "오늘 시장은 대체로 힘이 있는 분위기예요."
    : avgChange < -0.3
      ? "오늘 시장은 조심해서 봐야 하는 분위기예요."
      : "오늘 시장은 오르는 곳과 내리는 곳이 섞여 있어요.";
  const techCount = videoData?.videos?.filter((item) => {
    const text = `${item.title} ${item.summary} ${item.topic_label ?? ""}`.toLowerCase();
    return text.includes("ai") || text.includes("tech") || text.includes("반도체") || text.includes("기술");
  }).length ?? 0;
  const newsLine = techCount > 0
    ? `기술주와 AI 이야기가 ${techCount}개 보여요. 관련 종목은 뉴스 이유를 같이 보면 좋아요.`
    : "눈에 띄는 한 업종보다 전체 시장 흐름을 먼저 보면 좋아요.";
  const fxLine = (usdkrw?.change_pct ?? 0) > 0.2
    ? "원/달러가 오르면 해외 물건을 사오는 회사는 부담이 커질 수 있어요."
    : (usdkrw?.change_pct ?? 0) < -0.2
      ? "원/달러가 내려가면 해외 주식의 원화 수익률이 달라질 수 있어요."
      : "환율은 큰 변화보다 방향을 천천히 보면 돼요.";
  const vixLine = vix?.value != null && vix.value >= 20
    ? "VIX가 높아 시장이 평소보다 흔들릴 수 있어요."
    : vix?.value != null
      ? "VIX는 아직 큰 공포보다 관찰 구간에 가까워요."
      : "VIX 데이터는 확인 중이에요.";
  const lines = [marketLine, newsLine, fxLine, vixLine].slice(0, 3);

  return (
    <div className="rounded-xl border border-terminal-accent/25 bg-terminal-panel p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <div className="text-[10px] font-mono text-terminal-accent uppercase tracking-widest">오늘의 핵심 3줄</div>
          <div className="mt-1 text-xs text-terminal-text-dim">시장·뉴스·환율 중 오늘 먼저 볼 것을 쉬운 말로 줄였어요.</div>
        </div>
        <div className="rounded-full border border-terminal-border px-2 py-1 text-[10px] font-mono text-terminal-text-dim">참고용</div>
      </div>
      <div className="space-y-2">
        {lines.map((line, index) => (
          <div key={line} className="flex gap-2 rounded-lg border border-terminal-border bg-terminal-bg/35 px-3 py-2 text-xs text-terminal-text-secondary">
            <span className="font-mono text-terminal-accent">{index + 1}</span>
            <span>{line}</span>
          </div>
        ))}
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

function basisLabel(basis?: string) {
  if (basis === "transcript_ai" || basis === "transcript") return "자막 근거";
  if (basis === "video_ai") return "영상 AI 근거";
  return "제목·설명 근거";
}

function simpleInsightText(item: VideoNewsResponse["videos"][number]) {
  const raw = item.insight || item.summary_ko || item.summary || item.title_ko || item.title;
  const text = raw.replace(/^제목·설명으로 추정한 핵심:\s*/i, "").trim();
  return text.length > 120 ? `${text.slice(0, 120)}…` : text;
}

function AIInsightSummary({ data, expanded, onToggle }: {
  data: VideoNewsResponse;
  expanded: boolean;
  onToggle: () => void;
}) {
  const highlights = (data.videos || []).slice(0, 3);
  const score = Number.isFinite(data.market_score) ? Math.round(data.market_score) : null;
  const scoreLabel = score == null ? "확인 중" : score >= 65 ? "좋은 뉴스가 조금 우세" : score <= 35 ? "조심 신호가 조금 우세" : "좋고 나쁜 뉴스가 섞임";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-terminal-border bg-terminal-bg/35 px-3 py-2">
        <div>
          <div className="text-xs font-semibold text-terminal-text-primary">AI가 고른 오늘의 시장 읽기</div>
          <div className="mt-1 text-[11px] leading-4 text-terminal-text-dim">뉴스와 영상 제목·설명·자막 가능 여부를 보고, 먼저 볼 내용만 3개로 줄였어요.</div>
        </div>
        <div className="rounded-lg border border-terminal-accent/30 bg-terminal-accent/10 px-3 py-2 text-right">
          <div className="text-[10px] font-mono text-terminal-text-dim">시장 점수</div>
          <div className="text-sm font-mono font-bold text-terminal-accent">{score ?? "--"}</div>
          <div className="text-[10px] text-terminal-text-secondary">{scoreLabel}</div>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        {highlights.map((item, index) => (
          <div key={item.id || item.url || index} className="rounded-lg border border-terminal-border bg-terminal-bg/45 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="rounded border border-terminal-border px-1.5 py-0.5 text-[10px] font-mono text-terminal-text-dim">핵심 {index + 1}</span>
              <span className="text-[10px] font-mono text-terminal-yellow">{basisLabel(item.content_basis)}</span>
            </div>
            <div className="line-clamp-2 text-xs font-semibold leading-5 text-terminal-text-primary">{item.title_ko || item.title}</div>
            <div className="mt-2 line-clamp-3 text-[11px] leading-5 text-terminal-text-secondary">{simpleInsightText(item)}</div>
            <div className="mt-2 text-[10px] font-mono text-terminal-text-dim">출처: {item.source || item.channel || "확인 중"}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-terminal-border bg-terminal-bg/30 px-3 py-2 text-[11px] leading-5 text-terminal-text-dim">
        왜 이렇게 말했나요? 위 3개는 최근 영상/뉴스 중 시장 전체에 영향을 줄 만한 제목과 설명을 먼저 고른 거예요. 자막이 없으면 제목·설명 기반이라 정확도가 낮을 수 있어요. 이 내용은 투자 추천이 아니라 읽을 순서를 돕는 참고용이에요.
      </div>

      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-center gap-1 rounded-lg border border-terminal-border bg-terminal-bg/30 px-3 py-2 text-[11px] font-mono text-terminal-text-secondary transition hover:border-terminal-accent/50 hover:text-terminal-accent"
      >
        {expanded ? "자세한 AI 원문 접기" : "자세한 AI 원문 보기"}
        <ChevronDown size={13} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="rounded-lg border border-terminal-border bg-terminal-bg/35 p-3">
          <InsightBlock text={data.overall_insight} />
        </div>
      )}
    </div>
  );
}

export function HomePage({ onTabChange }: { onTabChange: (tab: TabId) => void }) {
  const { beginnerMode } = useSettingsStore();
  const [indices, setIndices]         = useState<Record<string, any>>({});
  const [forex, setForex]             = useState<Record<string, any>>({});
  const [commodities, setCommodities] = useState<Record<string, any>>({});
  const [videoData, setVideoData]     = useState<VideoNewsResponse | null>(null);
  const [loading, setLoading]         = useState(true);
  const [insightLoading, setInsightLoading] = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [showRawInsight, setShowRawInsight] = useState(false);
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
    data_status: obj[key]?.data_status,
    data_quality_warning: obj[key]?.data_quality_warning,
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
  const allChanges = [...usCards, ...krCards]
    .filter((c) => !c.data_quality_warning)
    .map((c) => c.change_pct ?? 0);
  const avgChange  = allChanges.length ? allChanges.reduce((a, b) => a + b, 0) / allChanges.length : 0;
  const marketMood = avgChange > 0.3 ? "강세" : avgChange < -0.3 ? "약세" : "혼조";
  const moodColor  = avgChange > 0.3 ? "text-terminal-green" : avgChange < -0.3 ? "text-terminal-red" : "text-terminal-yellow";

  const kstTime = clock.toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const vixCard = usCards.find((card) => card.label === "VIX");
  const usdkrwCard = fxCards.find((card) => card.label === "USD/KRW");
  const oilCard = comCards.find((card) => card.label === "Oil");

  return (
    <div className="h-full overflow-y-auto bg-terminal-bg">
      <div className="p-3 space-y-4 max-w-6xl mx-auto sm:p-4 sm:space-y-5">

        <FriendlyGuide onTabChange={onTabChange} beginnerMode={beginnerMode} />

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
          <>
            <MarketBrief
              mood={marketMood}
              avgChange={avgChange}
              vix={vixCard}
              usdkrw={usdkrwCard}
              oil={oilCard}
            />
            {beginnerMode && (
              <TodayThreeLines avgChange={avgChange} vix={vixCard} usdkrw={usdkrwCard} videoData={videoData} />
            )}
            <TrustNote />
          </>
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
              <AIInsightSummary
                data={videoData}
                expanded={showRawInsight}
                onToggle={() => setShowRawInsight((value) => !value)}
              />
            ) : (
              <div className="text-xs font-mono text-terminal-text-dim">인사이트를 불러올 수 없습니다.</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
