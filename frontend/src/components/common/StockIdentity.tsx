import { useMemo, useState } from "react";
import type { Quote } from "@/types";

interface StockIdentityProps {
  symbol: string;
  quote?: Quote;
  compact?: boolean;
  active?: boolean;
  subtitle?: string;
}

interface IdentityMeta {
  name: string;
  symbol: string;
  logoUrl?: string;
  flag?: string;
  accent: string;
}

const KNOWN_STOCKS: Record<string, Omit<IdentityMeta, "symbol">> = {
  "005930": { name: "삼성전자", flag: "🇰🇷", accent: "from-[#1F3DFF] to-[#17248D]" },
  "005930.KS": { name: "삼성전자", flag: "🇰🇷", accent: "from-[#1F3DFF] to-[#17248D]" },
  NVDA: { name: "엔비디아", flag: "🇺🇸", accent: "from-[#8CC63F] to-[#4B7F1B]" },
  AAPL: { name: "애플", flag: "🇺🇸", accent: "from-[#555] to-[#111]" },
  MSFT: { name: "마이크로소프트", flag: "🇺🇸", accent: "from-[#00A4EF] to-[#0B3D91]" },
  GOOGL: { name: "알파벳", flag: "🇺🇸", accent: "from-[#4285F4] to-[#1A237E]" },
  TSLA: { name: "테슬라", flag: "🇺🇸", accent: "from-[#E82127] to-[#7D1115]" },
  AMZN: { name: "아마존", flag: "🇺🇸", accent: "from-[#FF9900] to-[#3B2410]" },
  META: { name: "메타", flag: "🇺🇸", accent: "from-[#0866FF] to-[#102A6B]" },
  SPY: { name: "S&P 500 ETF", flag: "🇺🇸", accent: "from-[#315C99] to-[#101B2E]" },
  QQQ: { name: "나스닥 100 ETF", flag: "🇺🇸", accent: "from-[#6D5DFB] to-[#15103D]" },
};

function cleanSymbol(symbol: string) {
  return (symbol || "").trim().toUpperCase();
}

function displaySymbol(symbol: string) {
  return cleanSymbol(symbol).replace(/\.(KS|KQ)$/i, "");
}

function getFallbackFlag(symbol: string, quote?: Quote) {
  const normalized = cleanSymbol(quote?.symbol || symbol);
  if (/^\d{6}(\.(KS|KQ))?$/.test(normalized) || quote?.currency === "KRW") return "🇰🇷";
  if (quote?.currency === "USD" || /^[A-Z]{1,5}$/.test(normalized)) return "🇺🇸";
  return undefined;
}

function initials(name: string, symbol: string) {
  const base = name && name !== symbol ? name : displaySymbol(symbol);
  const korean = base.match(/[가-힣]/g);
  if (korean?.length) return korean.slice(0, 2).join("");
  return displaySymbol(symbol).slice(0, 2);
}

function resolveIdentity(symbol: string, quote?: Quote): IdentityMeta {
  const normalized = cleanSymbol(quote?.symbol || symbol);
  const stripped = displaySymbol(normalized);
  const known = KNOWN_STOCKS[normalized] || KNOWN_STOCKS[stripped];

  return {
    symbol: stripped,
    name: quote?.name && quote.name !== normalized ? quote.name : known?.name || stripped,
    logoUrl: quote?.logo_url || undefined,
    flag: known?.flag || getFallbackFlag(symbol, quote),
    accent: known?.accent || "from-terminal-accent/70 to-[#111]",
  };
}

export function StockIdentity({ symbol, quote, compact = false, active = false, subtitle }: StockIdentityProps) {
  const meta = useMemo(() => resolveIdentity(symbol, quote), [symbol, quote]);
  const [logoFailed, setLogoFailed] = useState(false);
  const sizeClass = compact ? "h-8 w-8" : "h-11 w-11";
  const logoSizeClass = compact ? "h-5 w-5" : "h-7 w-7";

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div className={`relative flex ${sizeClass} shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${meta.accent} shadow-[0_0_18px_rgba(0,0,0,0.25)]`}>
        {meta.logoUrl && !logoFailed ? (
          <img
            src={meta.logoUrl}
            alt={`${meta.name} 로고`}
            className={`${logoSizeClass} rounded-sm object-contain`}
            loading="lazy"
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <span className="text-[10px] font-bold text-white">{initials(meta.name, meta.symbol)}</span>
        )}
        {meta.flag && (
          <span className="absolute -bottom-1 -right-1 rounded-sm border border-[#151515] bg-[#f4f4f4] px-0.5 text-[10px] leading-3 shadow">
            {meta.flag}
          </span>
        )}
      </div>

      <div className="min-w-0 leading-tight">
        <div className="mb-0.5 flex min-w-0 items-center gap-1.5">
          <span className={`rounded border border-terminal-border bg-[#1a1a1a] px-1.5 py-0.5 font-mono font-semibold text-terminal-accent ${compact ? "text-[9px]" : "text-[10px]"}`}>
            {meta.symbol}
          </span>
          {subtitle && <span className="truncate text-[10px] font-mono text-terminal-text-dim">{subtitle}</span>}
        </div>
        <div className={`truncate font-mono ${compact ? "text-[11px]" : "text-xs"} ${active ? "text-terminal-accent" : "text-terminal-text-secondary"}`}>
          {meta.name}
        </div>
      </div>
    </div>
  );
}

export { displaySymbol };
