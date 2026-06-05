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
  return `${currencySymbol(currency)}${formatNumberValue(value, 0)}`;
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
