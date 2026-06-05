export type DataStatus = "live" | "delayed" | "stale" | "no_data" | "error" | "api_required";

export interface Quote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  change_pct: number;
  prev_close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  avg_volume: number;
  market_cap?: number;
  market_cap_krw?: number;
  pe_ratio?: number;
  pbr?: number;
  eps?: number;
  eps_krw?: number;
  bps?: number;
  dividend_yield?: number;
  "52w_high"?: number;
  "52w_low"?: number;
  "52w_high_krw"?: number;
  "52w_low_krw"?: number;
  sector?: string;
  industry?: string;
  shares_outstanding?: number;
  foreign_ownership?: number;
  currency: string;
  exchange: string;
  fx_rate_to_krw?: number;
  price_krw?: number;
  change_krw?: number;
  prev_close_krw?: number;
  open_krw?: number;
  high_krw?: number;
  low_krw?: number;
  data_status: DataStatus;
  data_source?: string;
  note?: string;
  error?: string;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChartData {
  symbol: string;
  period: string;
  interval: string;
  candles: Candle[];
  data_status: DataStatus;
  data_source?: string;
  error?: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  title_ko?: string | null;
  summary: string;
  summary_ko?: string | null;
  url: string;
  published_at: string;
  source: string;
  tickers: string[];
  sentiment: "positive" | "negative" | "neutral";
  importance: "high" | "normal";
  data_source: string;
  image?: string | null;
  video_url?: string | null;
  video_thumbnail?: string | null;
  media_type?: "article" | "video";
  translation?: string | null;
  tags?: string[];
  topic?: string;
  topic_label?: string;
  insight?: string;
  channel?: string;
}

export interface VideoNewsResponse {
  videos: NewsArticle[];
  topics: { id: string; label: string }[];
  overall_insight: string;
  updated_at: string;
}

export interface Position {
  id: number;
  symbol: string;
  market: string;
  quantity: number;
  avg_cost: number;
  current_price: number;
  market_value: number;
  pnl: number;
  pnl_pct: number;
  currency: string;
  sector?: string;
  name: string;
  quote_status: DataStatus;
}

export interface PortfolioSummary {
  total_market_value: number;
  total_cost_basis: number;
  total_pnl: number;
  total_pnl_pct: number;
}

export interface User {
  id: number;
  email: string;
  username: string;
  settings: Record<string, unknown>;
  watchlist: string[];
  layout_config: Record<string, unknown>;
}

export interface OptionContract {
  contractSymbol: string;
  strike: number;
  lastPrice: number;
  bid: number;
  ask: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  inTheMoney: boolean;
  change: number;
  percentChange: number;
}

export interface OptionsChain {
  symbol: string;
  expirations: string[];
  selected_expiration: string;
  calls: OptionContract[];
  puts: OptionContract[];
  data_status: DataStatus;
  error?: string;
}

export type ChartPeriod = "1mo" | "3mo" | "6mo" | "1y" | "2y" | "5y" | "10y";
export type ChartInterval = "1d" | "1wk" | "1mo";

export type TabId =
  | "markets"
  | "chart"
  | "news"
  | "portfolio"
  | "options"
  | "ai"
  | "orders"
  | "monitor";
