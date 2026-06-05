import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  geminiApiKey: string;
  finnhubApiKey: string;
  alpacaApiKey: string;
  alpacaSecretKey: string;
  enableRealTrading: boolean;
  defaultPortfolioId: number | null;
  language: "ko" | "en";
  autoRefreshInterval: number; // seconds
  showPaperTradingBadge: boolean;
  defaultQuoteDisplay: "KRW" | "NATIVE";
  symbolCurrencyOverrides: Record<string, "KRW" | "NATIVE">;
  setGeminiKey: (key: string) => void;
  setFinnhubKey: (key: string) => void;
  setAlpacaKeys: (apiKey: string, secret: string) => void;
  setEnableRealTrading: (v: boolean) => void;
  setDefaultPortfolioId: (id: number) => void;
  setAutoRefreshInterval: (s: number) => void;
  setDefaultQuoteDisplay: (mode: "KRW" | "NATIVE") => void;
  setSymbolCurrencyOverride: (symbol: string, mode: "KRW" | "NATIVE") => void;
  clearSymbolCurrencyOverride: (symbol: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      geminiApiKey: "",
      finnhubApiKey: "",
      alpacaApiKey: "",
      alpacaSecretKey: "",
      enableRealTrading: false,
      defaultPortfolioId: null,
      language: "ko",
      autoRefreshInterval: 30,
      showPaperTradingBadge: true,
      defaultQuoteDisplay: "KRW",
      symbolCurrencyOverrides: {},
      setGeminiKey: (key) => set({ geminiApiKey: key }),
      setFinnhubKey: (key) => set({ finnhubApiKey: key }),
      setAlpacaKeys: (apiKey, secret) =>
        set({ alpacaApiKey: apiKey, alpacaSecretKey: secret }),
      setEnableRealTrading: (v) => set({ enableRealTrading: v }),
      setDefaultPortfolioId: (id) => set({ defaultPortfolioId: id }),
      setAutoRefreshInterval: (s) => set({ autoRefreshInterval: s }),
      setDefaultQuoteDisplay: (mode) => set({ defaultQuoteDisplay: mode }),
      setSymbolCurrencyOverride: (symbol, mode) =>
        set((state) => ({
          symbolCurrencyOverrides: {
            ...state.symbolCurrencyOverrides,
            [symbol.toUpperCase()]: mode,
          },
        })),
      clearSymbolCurrencyOverride: (symbol) =>
        set((state) => {
          const next = { ...state.symbolCurrencyOverrides };
          delete next[symbol.toUpperCase()];
          return { symbolCurrencyOverrides: next };
        }),
    }),
    {
      name: "finterminal-settings",
    }
  )
);
