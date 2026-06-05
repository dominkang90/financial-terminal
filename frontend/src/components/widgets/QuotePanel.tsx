import { useEffect } from "react";
import { useMarketStore } from "@/store/marketStore";
import type { Quote } from "@/types";
import { ChangeValue, DataStatusBadge, formatNumber } from "@/components/common/DataStatus";
import { AISummary } from "@/components/widgets/AISummary";

function currencySymbol(currency?: string) {
  switch ((currency || "").toUpperCase()) {
    case "KRW":
      return "₩";
    case "JPY":
      return "¥";
    case "EUR":
      return "€";
    case "GBP":
      return "£";
    case "CNY":
      return "¥";
    default:
      return "$";
  }
}

function priceDecimals(currency?: string) {
  return ["KRW", "JPY"].includes((currency || "").toUpperCase()) ? 0 : 2;
}

function formatMoney(value?: number | null, currency?: string) {
  if (value === null || value === undefined) return "—";
  return `${currencySymbol(currency)}${formatNumber(value, priceDecimals(currency))}`;
}

function formatWithKrw(value?: number | null, currency?: string, krw?: number | null) {
  if (value === null || value === undefined) return "—";
  if ((currency || "").toUpperCase() === "KRW") return formatMoney(value, currency);
  if (krw) return `${formatMoney(value, currency)} · ${formatMoney(krw, "KRW")}`;
  return formatMoney(value, currency);
}

function formatLargeNumber(value?: number | null, currency?: string) {
  if (value === null || value === undefined) return "—";
  return `${currencySymbol(currency)}${formatNumber(value, 0)}`;
}

function detailRows(quote: Quote): [string, string][] {
  return [
    ["시가", formatWithKrw(quote.open, quote.currency, quote.open_krw)],
    ["고가", formatWithKrw(quote.high, quote.currency, quote.high_krw)],
    ["저가", formatWithKrw(quote.low, quote.currency, quote.low_krw)],
    ["전일종가", formatWithKrw(quote.prev_close, quote.currency, quote.prev_close_krw)],
    ["거래량", formatNumber(quote.volume ?? 0, 0)],
    ["평균거래량", formatNumber(quote.avg_volume ?? 0, 0)],
    ["시총", quote.market_cap_krw && quote.currency !== "KRW" ? `${formatLargeNumber(quote.market_cap, quote.currency)} · ${formatLargeNumber(quote.market_cap_krw, "KRW")}` : formatLargeNumber(quote.market_cap, quote.currency)],
    ["PER", quote.pe_ratio ? formatNumber(quote.pe_ratio) : "—"],
    ["PBR", quote.pbr ? formatNumber(quote.pbr) : "—"],
    ["EPS", quote.eps_krw && quote.currency !== "KRW" ? `${formatMoney(quote.eps, quote.currency)} · ${formatMoney(quote.eps_krw, "KRW")}` : formatMoney(quote.eps, quote.currency)],
    ["BPS", quote.bps ? formatMoney(quote.bps, quote.currency === "KRW" ? "KRW" : quote.currency) : "—"],
    ["배당수익률", quote.dividend_yield ? `${(quote.dividend_yield * 100).toFixed(2)}%` : "—"],
    ["52주 고가", formatWithKrw(quote["52w_high"], quote.currency, quote["52w_high_krw"])],
    ["52주 저가", formatWithKrw(quote["52w_low"], quote.currency, quote["52w_low_krw"])],
    ["외국인 보유율", quote.foreign_ownership ? `${quote.foreign_ownership.toFixed(2)}%` : "—"],
    ["상장주식수", quote.shares_outstanding ? formatNumber(quote.shares_outstanding, 0) : "—"],
    ["섹터", quote.sector ?? "—"],
    ["업종", quote.industry ?? "—"],
    ["거래소", quote.exchange ?? "—"],
  ];
}

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

  const showKrwPrimary = quote.currency !== "KRW" && !!quote.price_krw;
  const primaryPrice = showKrwPrimary ? formatMoney(quote.price_krw, "KRW") : formatMoney(quote.price, quote.currency);
  const originalPrice = formatMoney(quote.price, quote.currency);
  const rows = detailRows(quote);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-3 py-3 border-b border-terminal-border">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-mono text-terminal-text-secondary truncate max-w-32">{quote.name}</div>
            <div className="text-xs font-bold font-mono text-terminal-accent">{quote.symbol}</div>
          </div>
          <DataStatusBadge status={quote.data_status} />
        </div>

        <div className="mt-2">
          <span className="text-xl font-bold font-mono text-terminal-text-primary">{primaryPrice}</span>
          <span className="text-xs text-terminal-text-dim font-mono ml-1">{showKrwPrimary ? "KRW 환산" : quote.currency}</span>
        </div>

        {showKrwPrimary && (
          <div className="mt-1 text-2xs font-mono text-terminal-text-secondary space-y-0.5">
            <div>원래 가격: {originalPrice}</div>
            <div>적용 환율: ₩{formatNumber(quote.fx_rate_to_krw, 2)} / {quote.currency}</div>
          </div>
        )}

        <div className="flex items-center gap-2 mt-2">
          <ChangeValue value={quote.change_pct ?? 0} suffix="%" className="text-sm font-semibold" />
          <span className="text-2xs font-mono text-terminal-text-secondary">
            {showKrwPrimary && quote.change_krw ? `${formatMoney(quote.change_krw, "KRW")} / ` : ""}
            {formatMoney(quote.change, quote.currency)}
          </span>
        </div>
      </div>

      <div className="divide-y divide-terminal-border">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 px-3 py-1.5 hover:bg-terminal-border/30">
            <span className="text-2xs text-terminal-text-dim font-mono">{label}</span>
            <span className="text-2xs font-mono text-terminal-text-primary text-right break-all">{value}</span>
          </div>
        ))}
      </div>

      <AISummary />
    </div>
  );
}
