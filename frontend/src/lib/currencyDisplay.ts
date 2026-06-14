import type { Quote } from "@/types";

export type QuoteDisplayMode = "KRW" | "NATIVE";

export function currencySymbol(currency?: string) {
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

export function priceDecimals(currency?: string) {
  return ["KRW", "JPY"].includes((currency || "").toUpperCase()) ? 0 : 2;
}

export function formatNumberValue(value?: number | null, decimals = 2) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("ko-KR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatMoney(value?: number | null, currency?: string) {
  if (value === null || value === undefined) return "—";
  return `${currencySymbol(currency)}${formatNumberValue(value, priceDecimals(currency))}`;
}

export function formatLargeMoney(value?: number | null, currency?: string) {
  if (value === null || value === undefined) return "—";
  const symbol = currencySymbol(currency);
  const upper = (currency || "").toUpperCase();

  if (upper === "KRW") {
    const abs = Math.abs(value);
    if (abs >= 1e16) return `${symbol}${(value / 1e16).toFixed(2)}경`;
    if (abs >= 1e12) return `${symbol}${(value / 1e12).toFixed(0)}조`;
    if (abs >= 1e8) return `${symbol}${(value / 1e8).toFixed(0)}억`;
  }

  const abs = Math.abs(value);
  if (abs >= 1e12) return `${symbol}${(value / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${symbol}${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${symbol}${(value / 1e6).toFixed(2)}M`;

  return `${symbol}${formatNumberValue(value, 0)}`;
}

export function canToggleCurrency(quote?: Partial<Quote> | null) {
  if (!quote) return false;
  return (quote.currency || "").toUpperCase() !== "KRW" && quote.price_krw !== null && quote.price_krw !== undefined;
}

export function getEffectiveDisplayMode(
  quote: Partial<Quote> | null | undefined,
  defaultMode: QuoteDisplayMode,
  symbolOverride?: QuoteDisplayMode,
): QuoteDisplayMode {
  if (!canToggleCurrency(quote)) return "NATIVE";
  return symbolOverride || defaultMode;
}

export function getNativeCurrencyLabel(currency?: string) {
  switch ((currency || "").toUpperCase()) {
    case "USD":
      return "달러";
    case "JPY":
      return "엔화";
    case "EUR":
      return "유로";
    case "GBP":
      return "파운드";
    case "CNY":
      return "위안화";
    default:
      return currency || "현지통화";
  }
}

export function formatValueByMode(
  nativeValue: number | null | undefined,
  nativeCurrency: string | undefined,
  krwValue: number | null | undefined,
  mode: QuoteDisplayMode,
  large = false,
) {
  const formatter = large ? formatLargeMoney : formatMoney;

  if (mode === "KRW" && krwValue !== null && krwValue !== undefined) {
    const primary = formatter(krwValue, "KRW");
    const secondary = nativeValue !== null && nativeValue !== undefined
      ? formatter(nativeValue, nativeCurrency)
      : null;
    return { primary, secondary };
  }

  const primary = formatter(nativeValue, nativeCurrency);
  const secondary = krwValue !== null && krwValue !== undefined
    ? formatter(krwValue, "KRW")
    : null;
  return { primary, secondary };
}
