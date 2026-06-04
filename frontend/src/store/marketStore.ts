import { create } from "zustand";
import type { Quote, ChartData, ChartPeriod, ChartInterval } from "@/types";
import { marketApi } from "@/api/client";

interface MarketState {
  activeSymbol: string;
  indices: Record<string, Quote>;
  forex: Record<string, Quote>;
  commodities: Record<string, Quote>;
  rates: Record<string, Quote>;
  quotes: Record<string, Quote>;
  chartData: ChartData | null;
  chartPeriod: ChartPeriod;
  chartInterval: ChartInterval;
  watchlist: string[];
  isLoadingIndices: boolean;
  isLoadingChart: boolean;

  setActiveSymbol: (symbol: string) => void;
  setChartPeriod: (period: ChartPeriod) => void;
  setChartInterval: (interval: ChartInterval) => void;
  fetchIndices: () => Promise<void>;
  fetchForex: () => Promise<void>;
  fetchCommodities: () => Promise<void>;
  fetchRates: () => Promise<void>;
  fetchQuote: (symbol: string) => Promise<void>;
  fetchChart: (symbol?: string, period?: ChartPeriod, interval?: ChartInterval) => Promise<void>;
  fetchWatchlistQuotes: () => Promise<void>;
  setWatchlist: (symbols: string[]) => void;
  addToWatchlist: (symbol: string) => void;
  removeFromWatchlist: (symbol: string) => void;
}

const getInitialSymbol = (): string => {
  if (typeof window === "undefined") return "AAPL";
  return new URLSearchParams(window.location.search).get("symbol")?.toUpperCase() || "AAPL";
};

const syncUrl = (symbol: string) => {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("symbol", symbol);
  window.history.replaceState(null, "", url.toString());
};

export const useMarketStore = create<MarketState>((set, get) => ({
  activeSymbol: getInitialSymbol(),
  indices: {},
  forex: {},
  commodities: {},
  rates: {},
  quotes: {},
  chartData: null,
  chartPeriod: "6mo",
  chartInterval: "1d",
  watchlist: ["AAPL", "MSFT", "GOOGL", "NVDA", "TSLA", "AMZN", "META", "SPY", "QQQ"],
  isLoadingIndices: false,
  isLoadingChart: false,

  setActiveSymbol: (symbol) => {
    set({ activeSymbol: symbol });
    syncUrl(symbol);
    const { chartPeriod, chartInterval } = get();
    get().fetchChart(symbol, chartPeriod, chartInterval);
    get().fetchQuote(symbol);
  },

  setChartPeriod: (period) => {
    set({ chartPeriod: period });
    const { activeSymbol, chartInterval } = get();
    get().fetchChart(activeSymbol, period, chartInterval);
  },

  setChartInterval: (interval) => {
    set({ chartInterval: interval });
    const { activeSymbol, chartPeriod } = get();
    get().fetchChart(activeSymbol, chartPeriod, interval);
  },

  fetchIndices: async () => {
    set({ isLoadingIndices: true });
    try {
      const data = await marketApi.indices();
      set({ indices: data, isLoadingIndices: false });
    } catch {
      set({ isLoadingIndices: false });
    }
  },

  fetchForex: async () => {
    try {
      const data = await marketApi.forex();
      set({ forex: data });
    } catch {}
  },

  fetchCommodities: async () => {
    try {
      const data = await marketApi.commodities();
      set({ commodities: data });
    } catch {}
  },

  fetchRates: async () => {
    try {
      const data = await marketApi.rates();
      set({ rates: data });
    } catch {}
  },

  fetchQuote: async (symbol) => {
    try {
      const q = await marketApi.quote(symbol);
      set((state) => ({ quotes: { ...state.quotes, [symbol]: q } }));
    } catch {}
  },

  fetchChart: async (symbol, period, interval) => {
    const s = symbol || get().activeSymbol;
    const p = period || get().chartPeriod;
    const i = interval || get().chartInterval;
    set({ isLoadingChart: true });
    try {
      const data = await marketApi.chart(s, p, i);
      set({ chartData: data, isLoadingChart: false });
    } catch {
      set({ isLoadingChart: false });
    }
  },

  fetchWatchlistQuotes: async () => {
    const { watchlist } = get();
    if (watchlist.length === 0) return;
    try {
      const data = await marketApi.batchQuotes(watchlist);
      set((state) => ({ quotes: { ...state.quotes, ...data } }));
    } catch {}
  },

  setWatchlist: (symbols) => set({ watchlist: symbols }),

  addToWatchlist: (symbol) => {
    const { watchlist } = get();
    if (!watchlist.includes(symbol.toUpperCase())) {
      set({ watchlist: [...watchlist, symbol.toUpperCase()] });
    }
  },

  removeFromWatchlist: (symbol) => {
    set((state) => ({
      watchlist: state.watchlist.filter((s) => s !== symbol),
    }));
  },
}));
