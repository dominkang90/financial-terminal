import { useEffect, useState } from "react";
import { useMarketStore } from "@/store/marketStore";
import { ChangeValue, DataFreshnessLine, DataStatusBadge, MissingValue, getDataStatusLabel } from "@/components/common/DataStatus";

function getMarketStatus(timeZone: string, openHm: number, closeHm: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hour12: false, weekday: "short", hour: "numeric", minute: "numeric",
  }).formatToParts(new Date());
  const day = parts.find(p => p.type === "weekday")?.value || "";
  const h = parseInt(parts.find(p => p.type === "hour")?.value || "0");
  const m = parseInt(parts.find(p => p.type === "minute")?.value || "0");
  const hm = h * 60 + m;
  const isWeekday = ["Mon", "Tue", "Wed", "Thu", "Fri"].includes(day);
  return { isOpen: isWeekday && hm >= openHm && hm < closeHm, hm };
}

function MarketStatus() {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  const krx = getMarketStatus("Asia/Seoul", 9 * 60, 15 * 60 + 30);
  const nyse = getMarketStatus("America/New_York", 9 * 60 + 30, 16 * 60);

  const Badge = ({ label, open }: { label: string; open: boolean }) => (
    <div className="flex items-center gap-1 min-w-fit">
      <span className={`w-1.5 h-1.5 rounded-full ${open ? "bg-terminal-green animate-pulse" : "bg-terminal-text-dim"}`} />
      <span className="text-2xs font-mono text-terminal-text-secondary">{label}</span>
      <span className={`text-2xs font-mono ${open ? "text-terminal-green" : "text-terminal-text-dim"}`}>
        {open ? "OPEN" : "CLOSED"}
      </span>
    </div>
  );

  return (
    <>
      <Badge label="KRX" open={krx.isOpen} />
      <Badge label="NYSE" open={nyse.isOpen} />
    </>
  );
}

const DISPLAY_ORDER = [
  { key: "SPX", label: "S&P500" },
  { key: "NDX", label: "Nasdaq 100" },
  { key: "DJIA", label: "DOW" },
  { key: "VIX", label: "VIX" },
  { key: "RUT", label: "Russell 2000" },
  { key: "KOSPI", label: "KOSPI" },
];

function formatUpdatedTime() {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

export function IndexStrip() {
  const { indices, fetchIndices } = useMarketStore();
  const [updatedAt, setUpdatedAt] = useState<string>("");

  useEffect(() => {
    const refresh = () => {
      fetchIndices();
      setUpdatedAt(formatUpdatedTime());
    };
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [fetchIndices]);

  return (
    <div className="flex items-center gap-4 overflow-x-auto px-3 py-1 border-b border-terminal-border bg-terminal-header">
      {DISPLAY_ORDER.map(({ key, label }) => {
        const q = indices[key];
        if (!q) {
          return (
            <div key={key} className="flex items-center gap-1.5 min-w-fit">
              <span className="text-2xs text-terminal-text-dim font-mono">{label}</span>
              <MissingValue label="확인 중" className="text-2xs" />
            </div>
          );
        }

        const isUnreliable = Boolean(q.data_quality_warning);

        return (
          <div
            key={key}
            className="flex items-center gap-1.5 min-w-fit cursor-default"
            title={`출처: ${q.data_source || "제공처 확인 중"} · 상태: ${getDataStatusLabel(q.data_status)} · ${q.data_quality_warning || ""} · 확인: ${updatedAt || "확인 중"}`}
          >
            <span className="text-2xs text-terminal-text-secondary font-mono">{label}</span>
            <span className="text-xs font-mono text-terminal-text-primary">
              {isUnreliable ? "확인 필요" : q.price?.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? "확인 중"}
            </span>
            {!isUnreliable && <ChangeValue value={q.change_pct ?? 0} suffix="%" className="text-2xs" />}
            {q.data_status && !isUnreliable && <DataStatusBadge status={q.data_status} className="hidden lg:inline" />}
          </div>
        );
      })}

      <div className="hidden xl:block min-w-fit">
        <DataFreshnessLine checkedAt={updatedAt} source="각 지수 제공처" status="delayed" />
      </div>

      {/* 구분선 */}
      <div className="w-px h-3 bg-terminal-border mx-1 flex-shrink-0" />

      {/* 환율 간단 표시 */}
      <ForexMini />

      {/* 구분선 */}
      <div className="w-px h-3 bg-terminal-border mx-1 flex-shrink-0" />

      {/* 마켓 상태 */}
      <MarketStatus />
    </div>
  );
}

function ForexMini() {
  const { forex, fetchForex } = useMarketStore();

  useEffect(() => {
    fetchForex();
    const id = setInterval(fetchForex, 60_000);
    return () => clearInterval(id);
  }, [fetchForex]);

  const usdkrw = forex["USD/KRW"];
  if (!usdkrw) return null;

  return (
    <div className="flex items-center gap-1.5 min-w-fit">
      <span className="text-2xs text-terminal-text-dim font-mono">USD/KRW</span>
      <span className="text-xs font-mono text-terminal-text-primary">
        {usdkrw.price?.toLocaleString("ko-KR", { maximumFractionDigits: 0 }) ?? "확인 중"}
      </span>
      <ChangeValue value={usdkrw.change_pct ?? 0} suffix="%" className="text-2xs" />
    </div>
  );
}
