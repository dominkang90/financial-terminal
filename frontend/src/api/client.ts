import axios from "axios";
import type { Quote, ChartData, ChartPeriod, ChartInterval, NewsArticle, OptionsChain } from "@/types";

const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : "/api";

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
});

// JWT 토큰 자동 첨부
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 401 처리
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
    }
    return Promise.reject(err);
  }
);

// ── 시장 데이터 ──────────────────────────────────────────
export const marketApi = {
  quote: (symbol: string): Promise<Quote> =>
    api.get(`/market/quote/${symbol}`).then((r) => r.data),

  batchQuotes: (symbols: string[]): Promise<Record<string, Quote>> =>
    api.post("/market/quotes", { symbols }).then((r) => r.data),

  indices: () => api.get("/market/indices").then((r) => r.data),
  forex: () => api.get("/market/forex").then((r) => r.data),
  commodities: () => api.get("/market/commodities").then((r) => r.data),
  rates: () => api.get("/market/rates").then((r) => r.data),

  chart: (symbol: string, period: ChartPeriod, interval: ChartInterval): Promise<ChartData> =>
    api.get(`/market/chart/${symbol}`, { params: { period, interval } }).then((r) => r.data),

  search: (q: string): Promise<{ symbol: string; name: string; exchange: string; type: string }[]> =>
    api.get("/market/search", { params: { q } }).then((r) => r.data),

  options: (symbol: string): Promise<OptionsChain> =>
    api.get(`/market/options/${symbol}`).then((r) => r.data),

  etfHoldings: (symbol: string) =>
    api.get(`/market/etf/${symbol}/holdings`).then((r) => r.data),
};

// ── 뉴스 ──────────────────────────────────────────────────
export const newsApi = {
  list: (symbol?: string, limit = 30): Promise<NewsArticle[]> =>
    api.get("/news", { params: { symbol, limit } }).then((r) => r.data),

  translate: (text: string, apiKey?: string): Promise<{ translation: string | null }> =>
    api.post("/news/translate", { text, api_key: apiKey }).then((r) => r.data),
};

// ── AI ────────────────────────────────────────────────────
export const aiApi = {
  analyze: (symbol: string, apiKey?: string) =>
    api.post("/ai/analyze", { symbol, api_key: apiKey }).then((r) => r.data),

  chat: (message: string, symbol?: string, apiKey?: string) =>
    api.post("/ai/chat", { message, symbol, api_key: apiKey }).then((r) => r.data),
};

// ── 인증 ──────────────────────────────────────────────────
export const authApi = {
  register: (email: string, username: string, password: string) =>
    api.post("/auth/register", { email, username, password }).then((r) => r.data),

  login: (email: string, password: string) =>
    api.post("/auth/login", { email, password }).then((r) => r.data),

  me: () => api.get("/auth/me").then((r) => r.data),

  updateSettings: (body: Record<string, unknown>) =>
    api.put("/auth/settings", body).then((r) => r.data),
};

// ── 포트폴리오 ────────────────────────────────────────────
export const portfolioApi = {
  list: () => api.get("/portfolio/").then((r) => r.data),

  create: (name: string, isPaper = true, cashBalance = 0) =>
    api.post("/portfolio/", { name, is_paper: isPaper, cash_balance: cashBalance }).then((r) => r.data),

  positions: (portfolioId: number) =>
    api.get(`/portfolio/${portfolioId}/positions`).then((r) => r.data),

  addPosition: (portfolioId: number, data: {
    symbol: string; quantity: number; avg_cost: number; market?: string; currency?: string;
  }) => api.post(`/portfolio/${portfolioId}/positions`, data).then((r) => r.data),

  deletePosition: (portfolioId: number, positionId: number) =>
    api.delete(`/portfolio/${portfolioId}/positions/${positionId}`).then((r) => r.data),

  trade: (data: {
    portfolio_id: number; symbol: string; side: string;
    quantity: number; price: number; is_paper?: boolean;
  }) => api.post("/portfolio/trade", data).then((r) => r.data),
};
