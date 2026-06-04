import { useEffect } from "react";
import { useMarketStore } from "@/store/marketStore";
import { ChangeValue, DataStatusBadge, formatNumber } from "@/components/common/DataStatus";

export function QuotePanel() {
  const { activeSymbol, quotes, fetchQuote } = useMarketStore();
  const quote = quotes[activeSymbol];

  useEffect(() => {
    fetchQuote(activeSymbol);
    const id = setInterval(() => fetchQuote(activeSymbol), 30_000);
    return () => clearInterval(id);
  }, [activeSymbol, fetchQuote]);

  if (!quote) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-xs text-terminal-text-dim font-mono">로딩 중...</span>
      </div>
    );
  }

  if (quote.data_status === "error") {
    return (
      <div className="flex items-center justify-center h-full p-4 text-center">
        <div>
          <span className="text-xs text-terminal-red font-mono">데이터 없음: {quote.error}</span>
        </div>
      </div>
    );
  }

  const cs = quote.currency === "KRW" ? "₩" : quote.currency === "JPY" ? "¥" : "$";
  const pd = quote.currency === "KRW" || quote.currency === "JPY" ? 0 : 2;

  const rows: [string, string][] = [
    ["시가", `${cs}${formatNumber(quote.open, pd)}`],
    ["고가", `${cs}${formatNumber(quote.high, pd)}`],
    ["저가", `${cs}${formatNumber(quote.low, pd)}`],
    ["전일종가", `${cs}${formatNumber(quote.prev_close, pd)}`],
    ["거래량", formatNumber(quote.volume ?? 0, 0)],
    ["평균거래량", formatNumber(quote.avg_volume ?? 0, 0)],
    ["시총", quote.market_cap ? formatNumber(quote.market_cap, 0) : "—"],
    ["P/E", quote.pe_ratio ? formatNumber(quote.pe_ratio) : "—"],
    ["EPS", quote.eps ? `${cs}${formatNumber(quote.eps, pd)}` : "—"],
    ["배당수익률", quote.dividend_yield ? `${(quote.dividend_yield * 100).toFixed(2)}%` : "—"],
    ["52주 고가", quote["52w_high"] ? `${cs}${formatNumber(quote["52w_high"], pd)}` : "—"],
    ["52주 저가", quote["52w_low"] ? `${cs}${formatNumber(quote["52w_low"], pd)}` : "—"],
    ["섹터", quote.sector ?? "—"],
    ["거래소", quote.exchange ?? "—"],
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* 메인 가격 */}
      <div className="px-3 py-3 border-b border-terminal-border">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-mono text-terminal-text-secondary truncate max-w-32">{quote.name}</div>
            <div className="text-xs font-bold font-mono text-terminal-accent">{quote.symbol}</div>
          </div>
          <DataStatusBadge status={quote.data_status} />
        </div>

        <div className="mt-2">
          <span className="text-xl font-bold font-mono text-terminal-text-primary">
            {cs}{formatNumber(quote.price, pd)}
          </span>
          <span className="text-xs text-terminal-text-dim font-mono ml-1">{quote.currency}</span>
        </div>

        <div className="flex items-center gap-2 mt-1">
          <ChangeValue value={quote.change ?? 0} className="text-sm font-semibold" />
          <ChangeValue value={quote.change_pct ?? 0} suffix="%" className="text-sm font-semibold" />
        </div>
      </div>

      {/* 상세 데이터 */}
      <div className="divide-y divide-terminal-border">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between px-3 py-1.5 hover:bg-terminal-border/30">
            <span className="text-2xs text-terminal-text-dim font-mono">{label}</span>
            <span className="text-2xs font-mono text-terminal-text-primary">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
