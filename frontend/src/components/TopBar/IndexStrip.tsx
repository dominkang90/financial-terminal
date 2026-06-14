import { useEffect, useState } from "react";
import { useMarketStore } from "@/store/marketStore";
import { ChangeValue, DataStatusBadge } from "@/components/common/DataStatus";

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
              <span className="text-2xs text-terminal-text-dim font-mono">—</span>
            </div>
          );
        }

        return (
          <div
            key={key}
            className="flex items-center gap-1.5 min-w-fit cursor-default"
            title={`출처: ${q.data_source || "제공처 확인 중"} · 상태: ${q.data_status || "제공처 기준"} · 확인: ${updatedAt || "확인 중"}`}
          >
            <span className="text-2xs text-terminal-text-secondary font-mono">{label}</span>
            <span className="text-xs font-mono text-terminal-text-primary">
              {q.price?.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? "—"}
            </span>
            <ChangeValue value={q.change_pct ?? 0} suffix="%" className="text-2xs" />
            {q.data_status && <DataStatusBadge status={q.data_status} className="hidden lg:inline" />}
          </div>
        );
      })}

      {/* 지수 신뢰 안내 */}
      <div className="hidden xl:flex items-center gap-1 min-w-fit text-[10px] font-mono text-terminal-text-dim">
        <span>지수 출처/지연은 항목에 마우스를 올리면 보여요</span>
        {updatedAt && <span>· 확인 {updatedAt}</span>}
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
        {usdkrw.price?.toLocaleString("ko-KR", { maximumFractionDigits: 0 }) ?? "—"}
      </span>
      <ChangeValue value={usdkrw.change_pct ?? 0} suffix="%" className="text-2xs" />
    </div>
  );
}
