import { useEffect, useState } from "react";
import { Plus, X, Star } from "lucide-react";
import { useMarketStore } from "@/store/marketStore";
import { ChangeValue, formatNumber } from "@/components/common/DataStatus";

function formatWatchPrice(price?: number, currency = "USD") {
  if (price === null || price === undefined) return "—";
  const symbol = currency === "KRW" ? "₩" : currency === "JPY" ? "¥" : "$";
  const decimals = currency === "KRW" || currency === "JPY" ? 0 : 2;
  return `${symbol}${formatNumber(price, decimals)}`;
}

export function WatchList() {
  const {
    watchlist, quotes, activeSymbol,
    setActiveSymbol, addToWatchlist, removeFromWatchlist,
    fetchWatchlistQuotes,
  } = useMarketStore();
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
        <div className="grid grid-cols-[1fr_auto_auto] gap-1 px-3 py-1 text-2xs text-terminal-text-dim font-mono border-b border-terminal-border">
          <span>종목</span>
          <span className="text-right">가격</span>
          <span className="text-right w-14">등락</span>
        </div>

        {watchlist.map((symbol) => {
          const q = quotes[symbol];
          const isActive = symbol === activeSymbol;
          const showKrw = q && q.currency !== "KRW" && !!q.price_krw;

          return (
            <div
              key={symbol}
              onClick={() => setActiveSymbol(symbol)}
              className={`group grid grid-cols-[1fr_auto_auto] gap-1 px-3 py-1.5 cursor-pointer transition-colors border-b border-terminal-border/50 ${
                isActive
                  ? "bg-terminal-accent/10 border-l-2 border-l-terminal-accent"
                  : "hover:bg-terminal-border"
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className={`text-xs font-mono font-semibold truncate ${isActive ? "text-terminal-accent" : "text-terminal-text-primary"}`}>
                  {q?.symbol || symbol}
                </span>
              </div>

              <div className="text-right leading-tight">
                {q?.data_status === "error" || !q ? (
                  <span className="text-2xs text-terminal-text-dim font-mono">—</span>
                ) : (
                  <>
                    <div className="text-xs font-mono text-terminal-text-primary">
                      {showKrw ? formatWatchPrice(q.price_krw, "KRW") : formatWatchPrice(q.price, q.currency)}
                    </div>
                    {showKrw && (
                      <div className="text-[10px] font-mono text-terminal-text-dim">
                        {formatWatchPrice(q.price, q.currency)}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="text-right w-14 flex items-center justify-end gap-1">
                {q && q.data_status !== "error" ? (
                  <ChangeValue value={q.change_pct ?? 0} suffix="%" className="text-2xs" />
                ) : (
                  <span className="text-2xs text-terminal-text-dim font-mono">—</span>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); removeFromWatchlist(symbol); }}
                  className="opacity-0 group-hover:opacity-100 text-terminal-text-dim hover:text-terminal-red ml-1"
                >
                  <X size={9} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
