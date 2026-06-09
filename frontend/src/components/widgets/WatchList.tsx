import { useEffect, useState } from "react";
import { Plus, X, Star } from "lucide-react";
import { useMarketStore } from "@/store/marketStore";
import { useSettingsStore } from "@/store/settingsStore";
import { ChangeValue } from "@/components/common/DataStatus";
import { StockIdentity } from "@/components/common/StockIdentity";
import {
  canToggleCurrency,
  formatMoney,
  formatValueByMode,
  getEffectiveDisplayMode,
} from "@/lib/currencyDisplay";

function ChangeBadge({ value }: { value: number }) {
  const abs = Math.abs(value);
  const sign = value >= 0 ? "+" : "";
  const text = `${sign}${value.toFixed(2)}%`;

  if (abs >= 3) {
    return (
      <span className={`inline-block px-1.5 py-0.5 rounded text-2xs font-mono font-bold ${
        value >= 0 ? "bg-terminal-green/20 text-terminal-green" : "bg-terminal-red/20 text-terminal-red"
      }`}>{text}</span>
    );
  }
  return (
    <span className={`text-2xs font-mono ${value >= 0 ? "text-terminal-green" : "text-terminal-red"}`}>
      {text}
    </span>
  );
}

export function WatchList() {
  const {
    watchlist, quotes, activeSymbol,
    setActiveSymbol, addToWatchlist, removeFromWatchlist,
    fetchWatchlistQuotes,
  } = useMarketStore();
  const { defaultQuoteDisplay, symbolCurrencyOverrides } = useSettingsStore();
  const [addInput, setAddInput] = useState("");

  useEffect(() => {
    fetchWatchlistQuotes();
    const id = setInterval(fetchWatchlistQuotes, 30_000);
    return () => clearInterval(id);
  }, [watchlist, fetchWatchlistQuotes]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (addInput.trim()) {
      addToWatchlist(addInput.trim().toUpperCase());
      setAddInput("");
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-terminal-border flex-shrink-0">
        <Star size={11} className="text-terminal-yellow" />
        <span className="text-xs font-mono text-terminal-text-secondary">관심종목</span>
        <span className="text-2xs text-terminal-text-dim ml-auto">{watchlist.length}개</span>
      </div>

      <div className="px-3 py-1 border-b border-terminal-border text-[10px] font-mono text-terminal-text-dim">
        기본 표시: {defaultQuoteDisplay === "KRW" ? "원화 우선" : "달러/현지통화 우선"}
      </div>

      <form onSubmit={handleAdd} className="flex gap-1 px-2 py-1.5 border-b border-terminal-border flex-shrink-0">
        <input
          value={addInput}
          onChange={(e) => setAddInput(e.target.value)}
          placeholder="종목 추가 (예: TSLA / 005930)"
          className="flex-1 bg-transparent text-2xs font-mono text-terminal-text-primary placeholder-terminal-text-dim outline-none"
        />
        <button type="submit" className="text-terminal-accent hover:text-terminal-accent-dim">
          <Plus size={12} />
        </button>
      </form>

      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-[minmax(150px,1fr)_auto_auto] gap-2 px-3 py-1 text-2xs text-terminal-text-dim font-mono border-b border-terminal-border">
          <span>종목</span>
          <span className="text-right">가격</span>
          <span className="text-right w-14">등락</span>
        </div>

        {watchlist.map((symbol) => {
          const q = quotes[symbol];
          const isActive = symbol === activeSymbol;
          const symbolOverride = symbolCurrencyOverrides[symbol] || (q ? symbolCurrencyOverrides[q.symbol] : undefined);
          const displayMode = getEffectiveDisplayMode(q, defaultQuoteDisplay, symbolOverride);
          const priceDisplay = q ? formatValueByMode(q.price, q.currency, q.price_krw, displayMode) : null;
          const canToggle = canToggleCurrency(q);

          return (
            <div
              key={symbol}
              onClick={() => setActiveSymbol(symbol)}
              className={`group grid grid-cols-[minmax(150px,1fr)_auto_auto] gap-2 px-3 py-2 cursor-pointer transition-colors border-b border-terminal-border/50 ${
                isActive
                  ? "bg-terminal-accent/10 border-l-2 border-l-terminal-accent"
                  : "hover:bg-terminal-border"
              }`}
            >
              <StockIdentity symbol={symbol} quote={q} compact active={isActive} />

              <div className="text-right leading-tight">
                {q?.data_status === "error" || !q || !priceDisplay ? (
                  <span className="text-2xs text-terminal-text-dim font-mono">—</span>
                ) : (
                  <>
                    <div className="text-xs font-mono text-terminal-text-primary">
                      {priceDisplay.primary}
                    </div>
                    {canToggle && priceDisplay.secondary && (
                      <div className="text-[10px] font-mono text-terminal-text-dim">
                        {priceDisplay.secondary}
                      </div>
                    )}
                    {!canToggle && q.currency === "KRW" && (
                      <div className="text-[10px] font-mono text-terminal-text-dim">
                        {formatMoney(q.price, q.currency)}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="text-right w-16 flex items-center justify-end gap-1">
                {q && q.data_status !== "error" ? (
                  <ChangeBadge value={q.change_pct ?? 0} />
                ) : (
                  <span className="text-2xs text-terminal-text-dim font-mono">—</span>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); removeFromWatchlist(symbol); }}
                  title="삭제"
                  className="opacity-30 group-hover:opacity-100 text-terminal-text-dim hover:text-terminal-red transition-opacity ml-1 flex-shrink-0"
                >
                  <X size={10} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
