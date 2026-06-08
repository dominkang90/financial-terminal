import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Toaster } from "react-hot-toast";
import type { TabId } from "@/types";
import { TopBar } from "@/components/TopBar/TopBar";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { WatchList } from "@/components/widgets/WatchList";
import { MarketsPage } from "@/components/pages/MarketsPage";
import { ChartPage } from "@/components/pages/ChartPage";
import { NewsPage } from "@/components/pages/NewsPage";
import { PortfolioPage } from "@/components/pages/PortfolioPage";
import { OptionsPage } from "@/components/pages/OptionsPage";
import { OrdersPage } from "@/components/pages/OrdersPage";
import { AIPage } from "@/components/pages/AIPage";
import { MonitorPage } from "@/components/pages/MonitorPage";
import { HomePage } from "@/components/pages/HomePage";
import { useAuthStore } from "@/store/authStore";
import { useSettingsStore } from "@/store/settingsStore";

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [watchlistCollapsed, setWatchlistCollapsed] = useState(false);
  const { fetchMe } = useAuthStore();
  const { theme } = useSettingsStore();

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
  }, [theme]);

  const renderPage = () => {
    switch (activeTab) {
      case "home": return <HomePage />;
      case "markets": return <MarketsPage />;
      case "chart": return <ChartPage />;
      case "news": return <NewsPage />;
      case "portfolio": return <PortfolioPage />;
      case "options": return <OptionsPage />;
      case "orders": return <OrdersPage />;
      case "ai": return <AIPage />;
      case "monitor": return <MonitorPage />;
      default: return <HomePage />;
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-terminal-bg text-terminal-text-primary">
      <TopBar activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="flex flex-1 overflow-hidden pb-14 md:pb-0">
        <aside className={`hidden md:block flex-shrink-0 border-r border-terminal-border overflow-hidden transition-all duration-200 ${watchlistCollapsed ? "w-12" : "w-56"}`}>
          {watchlistCollapsed ? (
            <div className="flex h-full flex-col items-center gap-3 bg-terminal-bg py-3">
              <button
                type="button"
                onClick={() => setWatchlistCollapsed(false)}
                className="rounded border border-terminal-border p-1 text-terminal-text-secondary hover:text-terminal-text-primary"
                title="관심종목 열기"
              >
                <ChevronRight size={14} />
              </button>
              <div className="text-[10px] font-mono text-terminal-text-dim [writing-mode:vertical-rl]">관심종목</div>
            </div>
          ) : (
            <div className="flex h-full flex-col overflow-hidden">
              <div className="flex items-center justify-between border-b border-terminal-border px-2 py-1.5">
                <span className="text-2xs font-mono text-terminal-text-dim">GLOBAL WATCHLIST</span>
                <button
                  type="button"
                  onClick={() => setWatchlistCollapsed(true)}
                  className="rounded border border-terminal-border p-1 text-terminal-text-secondary hover:text-terminal-text-primary"
                  title="관심종목 닫기"
                >
                  <ChevronLeft size={12} />
                </button>
              </div>
              <WatchList />
            </div>
          )}
        </aside>
        <div className="min-w-0 flex-1 overflow-hidden">
          {renderPage()}
        </div>
      </main>
      <MobileTabBar activeTab={activeTab} onTabChange={setActiveTab} />

      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#111",
            color: "#e0e0e0",
            border: "1px solid #1a1a1a",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "11px",
          },
          success: { iconTheme: { primary: "#00cc44", secondary: "#000" } },
          error: { iconTheme: { primary: "#ff3333", secondary: "#fff" } },
        }}
      />
    </div>
  );
}
