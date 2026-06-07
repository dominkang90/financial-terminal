import { useMemo } from "react";
import type { Quote } from "@/types";

interface StockIdentityProps {
  symbol: string;
  quote?: Quote;
  compact?: boolean;
  active?: boolean;
  subtitle?: string;
}

const KNOWN_NAMES: Record<string, string> = {
  "005930": "삼성전자",
  "005930.KS": "삼성전자",
  NVDA: "엔비디아",
  AAPL: "애플",
  MSFT: "마이크로소프트",
  GOOGL: "알파벳",
  TSLA: "테슬라",
  AMZN: "아마존",
  META: "메타",
  SPY: "S&P 500 ETF",
  QQQ: "나스닥 100 ETF",
};

function displaySymbol(symbol: string) {
  return (symbol || "").trim().toUpperCase().replace(/\.(KS|KQ)$/i, "");
}

function resolveName(symbol: string, quote?: Quote): string {
  const sym = displaySymbol(symbol);
  if (quote?.name && quote.name !== sym) return quote.name;
  return KNOWN_NAMES[sym] || KNOWN_NAMES[symbol] || sym;
}

export function StockIdentity({ symbol, quote, compact = false, active = false, subtitle }: StockIdentityProps) {
  const sym = useMemo(() => displaySymbol(symbol), [symbol]);
  const name = useMemo(() => resolveName(symbol, quote), [symbol, quote]);

  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="min-w-0 leading-tight">
        <div className="mb-0.5 flex min-w-0 items-center gap-1.5">
          <span className={`shrink-0 rounded border border-terminal-border bg-[#1a1a1a] px-1.5 py-0.5 font-mono font-bold text-terminal-accent ${compact ? "text-[9px]" : "text-[10px]"}`}>
            {sym}
          </span>
          {subtitle && <span className="truncate text-[10px] font-mono text-terminal-text-dim">{subtitle}</span>}
        </div>
        <div className={`truncate font-mono ${compact ? "text-[10px]" : "text-xs"} ${active ? "text-terminal-accent" : "text-terminal-text-secondary"}`}>
          {name}
        </div>
      </div>
    </div>
  );
}

export { displaySymbol };
