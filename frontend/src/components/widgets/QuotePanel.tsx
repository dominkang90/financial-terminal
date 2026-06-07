import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { useMarketStore } from "@/store/marketStore";
import { useSettingsStore } from "@/store/settingsStore";
import type { Quote } from "@/types";
import { ChangeValue, DataStatusBadge, formatNumber } from "@/components/common/DataStatus";
import { AISummary } from "@/components/widgets/AISummary";
import {
  canToggleCurrency,
  formatLargeMoney,
  formatMoney,
  formatValueByMode,
  getEffectiveDisplayMode,
  getNativeCurrencyLabel,
} from "@/lib/currencyDisplay";

function detailRows(quote: Quote, mode: "KRW" | "NATIVE"): [string, string][] {
  const marketCap = formatValueByMode(quote.market_cap, quote.currency, quote.market_cap_krw, mode, true);
  const eps = formatValueByMode(quote.eps, quote.currency, quote.eps_krw, mode);
  const high52 = formatValueByMode(quote["52w_high"], quote.currency, quote["52w_high_krw"], mode);
  const low52 = formatValueByMode(quote["52w_low"], quote.currency, quote["52w_low_krw"], mode);
  const open = formatValueByMode(quote.open, quote.currency, quote.open_krw, mode);
  const high = formatValueByMode(quote.high, quote.currency, quote.high_krw, mode);
  const low = formatValueByMode(quote.low, quote.currency, quote.low_krw, mode);
  const prevClose = formatValueByMode(quote.prev_close, quote.currency, quote.prev_close_krw, mode);

  return [
    ["시가", open.secondary ? `${open.primary} · ${open.secondary}` : open.primary],
    ["고가", high.secondary ? `${high.primary} · ${high.secondary}` : high.primary],
    ["저가", low.secondary ? `${low.primary} · ${low.secondary}` : low.primary],
    ["전일종가", prevClose.secondary ? `${prevClose.primary} · ${prevClose.secondary}` : prevClose.primary],
    ["거래량", formatNumber(quote.volume ?? 0, 0)],
    ["평균거래량", formatNumber(quote.avg_volume ?? 0, 0)],
    ["시총", marketCap.secondary ? `${marketCap.primary} · ${marketCap.secondary}` : marketCap.primary],
    ["PER", quote.pe_ratio ? formatNumber(quote.pe_ratio) : "—"],
    ["PBR", quote.pbr ? formatNumber(quote.pbr) : "—"],
    ["EPS", eps.secondary ? `${eps.primary} · ${eps.secondary}` : eps.primary],
    ["BPS", quote.bps ? formatMoney(quote.bps, quote.currency === "KRW" ? "KRW" : quote.currency) : "—"],
    ["배당수익률", quote.dividend_yield ? `${(quote.dividend_yield * 100).toFixed(2)}%` : "—"],
    ["52주 고가", high52.secondary ? `${high52.primary} · ${high52.secondary}` : high52.primary],
    ["52주 저가", low52.secondary ? `${low52.primary} · ${low52.secondary}` : low52.primary],
    ["외국인 보유율", quote.foreign_ownership ? `${quote.foreign_ownership.toFixed(2)}%` : "—"],
    ["상장주식수", quote.shares_outstanding ? formatNumber(quote.shares_outstanding, 0) : "—"],
    ["섹터", quote.sector ?? "—"],
    ["업종", quote.industry ?? "—"],
    ["거래소", quote.exchange ?? "—"],
  ];
}

export function QuotePanel() {
  const { activeSymbol, quotes, fetchQuote } = useMarketStore();
  const {
    defaultQuoteDisplay,
    symbolCurrencyOverrides,
    setSymbolCurrencyOverride,
    clearSymbolCurrencyOverride,
  } = useSettingsStore();
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

  const canToggle = canToggleCurrency(quote);
  const symbolOverride = symbolCurrencyOverrides[quote.symbol] || symbolCurrencyOverrides[activeSymbol];
  const displayMode = getEffectiveDisplayMode(quote, defaultQuoteDisplay, symbolOverride);
  const priceDisplay = formatValueByMode(quote.price, quote.currency, quote.price_krw, displayMode);
  const changeDisplay = formatValueByMode(quote.change, quote.currency, quote.change_krw, displayMode);
  const rows = detailRows(quote, displayMode);
  const nativeLabel = getNativeCurrencyLabel(quote.currency);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-3 py-3 border-b border-terminal-border">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="min-w-0">
            <div className="text-[10px] font-bold font-mono text-terminal-accent">{quote.symbol}</div>
            <div className="text-[10px] font-mono text-terminal-text-secondary truncate">{quote.name}</div>
          </div>
          <DataStatusBadge status={quote.data_status} />
        </div>
        {canToggle && (
          <div className="flex items-center gap-1 mb-1">
            <button
              type="button"
              onClick={() => setSymbolCurrencyOverride(quote.symbol, "KRW")}
              className={`px-2 py-0.5 rounded text-2xs font-mono border ${
                displayMode === "KRW"
                  ? "bg-terminal-accent text-black border-terminal-accent"
                  : "text-terminal-text-dim border-terminal-border hover:text-terminal-text-primary"
              }`}
            >
              원화
            </button>
            <button
              type="button"
              onClick={() => setSymbolCurrencyOverride(quote.symbol, "NATIVE")}
              className={`px-2 py-0.5 rounded text-2xs font-mono border ${
                displayMode === "NATIVE"
                  ? "bg-terminal-accent text-black border-terminal-accent"
                  : "text-terminal-text-dim border-terminal-border hover:text-terminal-text-primary"
              }`}
            >
              {nativeLabel}
            </button>
            {symbolOverride && symbolOverride !== defaultQuoteDisplay && (
              <button
                type="button"
                onClick={() => clearSymbolCurrencyOverride(quote.symbol)}
                className="px-1.5 py-0.5 rounded text-2xs font-mono border border-terminal-border text-terminal-text-dim hover:text-terminal-text-primary inline-flex items-center gap-1"
                title="기본값으로 되돌리기"
              >
                <RotateCcw size={9} />
                기본
              </button>
            )}
          </div>
        )}

        <div className="mt-2">
          <span className="text-xl font-bold font-mono text-terminal-text-primary">{priceDisplay.primary}</span>
          <span className="text-xs text-terminal-text-dim font-mono ml-1">
            {displayMode === "KRW" ? "원화 기준" : `${nativeLabel} 기준`}
          </span>
        </div>

        {canToggle && (
          <div className="mt-1 text-2xs font-mono text-terminal-text-secondary space-y-0.5">
            {priceDisplay.secondary && <div>비교 가격: {priceDisplay.secondary}</div>}
            {quote.fx_rate_to_krw && <div>적용 환율: ₩{formatNumber(quote.fx_rate_to_krw, 2)} / {quote.currency}</div>}
            <div>기본 설정: {defaultQuoteDisplay === "KRW" ? "원화 우선" : "달러/현지통화 우선"}</div>
          </div>
        )}

        <div className="flex items-center gap-2 mt-2">
          <ChangeValue value={quote.change_pct ?? 0} suffix="%" className="text-sm font-semibold" />
          <span className="text-2xs font-mono text-terminal-text-secondary">
            {changeDisplay.secondary ? `${changeDisplay.primary} / ${changeDisplay.secondary}` : changeDisplay.primary}
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
