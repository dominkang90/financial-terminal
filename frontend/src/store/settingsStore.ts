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
  setGeminiKey: (key: string) => void;
  setFinnhubKey: (key: string) => void;
  setAlpacaKeys: (apiKey: string, secret: string) => void;
  setEnableRealTrading: (v: boolean) => void;
  setDefaultPortfolioId: (id: number) => void;
  setAutoRefreshInterval: (s: number) => void;
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
      setGeminiKey: (key) => set({ geminiApiKey: key }),
      setFinnhubKey: (key) => set({ finnhubApiKey: key }),
      setAlpacaKeys: (apiKey, secret) =>
        set({ alpacaApiKey: apiKey, alpacaSecretKey: secret }),
      setEnableRealTrading: (v) => set({ enableRealTrading: v }),
      setDefaultPortfolioId: (id) => set({ defaultPortfolioId: id }),
      setAutoRefreshInterval: (s) => set({ autoRefreshInterval: s }),
    }),
    {
      name: "finterminal-settings",
    }
  )
);
