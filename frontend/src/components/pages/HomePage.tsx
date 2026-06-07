import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus, RefreshCw } from "lucide-react";
import { marketApi, newsApi } from "@/api/client";
import type { VideoNewsResponse } from "@/types";

interface IndexCard {
  label: string;
  value: number | null;
  change: number | null;
  change_pct: number | null;
  currency?: string;
}

function fmt(v: number | null | undefined, decimals = 2): string {
  if (v == null || isNaN(v)) return "—";
  return v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function MarketCard({ label, value, change, change_pct }: IndexCard) {
  const up = (change_pct ?? 0) > 0;
  const down = (change_pct ?? 0) < 0;
  const color = up ? "text-terminal-green" : down ? "text-terminal-red" : "text-terminal-text-dim";
  const bgColor = up ? "bg-terminal-green/5" : down ? "bg-terminal-red/5" : "";
  const Icon = up ? TrendingUp : down ? TrendingDown : Minus;

  return (
    <div className={`bg-[#111] border border-[#222] rounded-xl p-3 flex flex-col gap-1 ${bgColor}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-terminal-text-dim uppercase tracking-wider">{label}</span>
        <Icon size={11} className={color} />
      </div>
      <div className="text-sm font-mono font-bold text-terminal-text-primary">
        {value != null ? fmt(value) : "—"}
      </div>
      <div className={`text-[10px] font-mono ${color}`}>
        {change != null && change_pct != null
          ? `${change >= 0 ? "+" : ""}${fmt(change)} (${change_pct >= 0 ? "+" : ""}${fmt(change_pct)}%)`
          : "—"}
      </div>
    </div>
  );
}

function toKST(utcStr: string): string {
  try {
    const d = new Date(utcStr);
    return d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) + " KST";
  } catch {
    return utcStr;
  }
}

function InsightBlock({ text }: { text: string }) {
  return (
    <div className="whitespace-pre-wrap text-xs font-mono text-terminal-text-secondary leading-relaxed">
      {text.split("\n").map((line, i) => {
        if (line.startsWith("[ ") && line.endsWith(" ]")) {
          return <div key={i} className="mt-4 mb-1 text-[10px] font-mono text-terminal-accent uppercase tracking-widest">{line}</div>;
        }
        if (line.startsWith("  [")) {
          const match = line.match(/^\s+\[([^\]]+)\]\s*(.*)/);
          if (match) {
            return (
              <div key={i} className="flex gap-2 py-0.5 border-b border-[#1a1a1a]">
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
  const [indices, setIndices] = useState<Record<string, any>>({});
  const [forex, setForex] = useState<Record<string, any>>({});
  const [commodities, setCommodities] = useState<Record<string, any>>({});
  const [videoData, setVideoData] = useState<VideoNewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [insightLoading, setInsightLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadMarket = async () => {
    const [idx, fx, com] = await Promise.all([
      marketApi.indices().catch(() => ({})),
      marketApi.forex().catch(() => ({})),
      marketApi.commodities().catch(() => ({})),
    ]);
    setIndices(idx);
    setForex(fx);
    setCommodities(com);
    setLoading(false);
  };

  const loadInsight = async () => {
    const data = await newsApi.videos("all", 30).catch(() => null);
    setVideoData(data);
    setInsightLoading(false);
  };

  useEffect(() => {
    loadMarket();
    loadInsight();
    const id = setInterval(loadMarket, 60_000);
    return () => clearInterval(id);
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
    currency: obj[key]?.currency,
  });

  const marketCards: IndexCard[] = loading
    ? []
    : [
        q(indices, "NDX"),
        q(indices, "SPX"),
        q(indices, "DJIA"),
        q(indices, "VIX"),
        q(indices, "KOSPI"),
        q(indices, "KOSDAQ"),
        q(forex, "USD/KRW"),
        q(commodities, "Gold"),
        q(commodities, "Oil"),
      ].filter((c) => c.value != null);

  // 장 상태 (간단히 현재 시각 기준 추정)
  const now = new Date();
  const kstHour = (now.getUTCHours() + 9) % 24;
  const krOpen = kstHour >= 9 && kstHour < 15.5;
  const usHour = (now.getUTCHours() - 5 + 24) % 24; // EST 근사
  const usOpen = usHour >= 9.5 && usHour < 16;

  return (
    <div className="h-full overflow-y-auto bg-[#0a0a0a] p-4 space-y-4">

      {/* 장 상태 바 */}
      <div className="flex items-center gap-4 px-3 py-2 bg-[#111] border border-[#222] rounded-xl text-[10px] font-mono">
        <span className={`flex items-center gap-1.5 ${krOpen ? "text-terminal-green" : "text-terminal-text-dim"}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${krOpen ? "bg-terminal-green animate-pulse" : "bg-[#333]"}`} />
          국내장 {krOpen ? "개장 중" : "마감"}
        </span>
        <span className={`flex items-center gap-1.5 ${usOpen ? "text-terminal-green" : "text-terminal-text-dim"}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${usOpen ? "bg-terminal-green animate-pulse" : "bg-[#333]"}`} />
          미국장 {usOpen ? "개장 중" : "마감"}
        </span>
        <span className="ml-auto text-terminal-text-dim">
          {now.toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" })} KST
        </span>
      </div>

      {/* 주요 지수 그리드 */}
      <div>
        <div className="text-[10px] font-mono text-terminal-accent uppercase tracking-widest mb-2">주요 지수</div>
        {loading ? (
          <div className="text-xs font-mono text-terminal-text-dim">불러오는 중...</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {marketCards.map((card) => (
              <MarketCard key={card.label} {...card} />
            ))}
          </div>
        )}
      </div>

      {/* AI 인사이트 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] font-mono text-terminal-accent uppercase tracking-widest">AI 시장 인사이트</div>
          <div className="flex items-center gap-2">
            {videoData?.updated_at && (
              <span className="text-[10px] font-mono text-terminal-text-dim">
                기준: {toKST(videoData.updated_at)}
              </span>
            )}
            <button
              type="button"
              onClick={handleRefreshInsight}
              disabled={refreshing || insightLoading}
              className="flex items-center gap-1 text-[10px] font-mono text-terminal-text-dim hover:text-terminal-accent border border-[#222] rounded px-2 py-0.5 disabled:opacity-40"
            >
              <RefreshCw size={9} className={refreshing ? "animate-spin" : ""} />
              새로고침
            </button>
          </div>
        </div>

        <div className="bg-[#111] border border-[#222] rounded-xl p-4">
          {insightLoading ? (
            <div className="text-xs font-mono text-terminal-text-dim">유튜브 영상 분석 중...</div>
          ) : videoData?.overall_insight ? (
            <InsightBlock text={videoData.overall_insight} />
          ) : (
            <div className="text-xs font-mono text-terminal-text-dim">인사이트를 불러올 수 없습니다.</div>
          )}
        </div>
      </div>

    </div>
  );
}
