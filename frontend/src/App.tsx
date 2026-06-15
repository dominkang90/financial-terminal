import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Star, X } from "lucide-react";
import { Toaster, toast } from "react-hot-toast";
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
import { AdminPage } from "@/components/pages/AdminPage";
import { useAuthStore } from "@/store/authStore";
import { useSettingsStore } from "@/store/settingsStore";

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [watchlistCollapsed, setWatchlistCollapsed] = useState(false);
  const [mobileWatchlistOpen, setMobileWatchlistOpen] = useState(false);
  const handledOAuthRef = useRef(false);
  const { fetchMe, finishOAuthLogin } = useAuthStore();
  const { theme } = useSettingsStore();

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const queryParams = new URLSearchParams(window.location.search);
    const oauthToken = hashParams.get("oauth_token") ?? queryParams.get("oauth_token");
    const oauthUser = hashParams.get("oauth_user") ?? queryParams.get("oauth_user");
    const oauthError = hashParams.get("oauth_error") ?? queryParams.get("oauth_error");

    if (oauthToken) {
      handledOAuthRef.current = true;
      let user;
      try {
        user = oauthUser ? JSON.parse(oauthUser) : undefined;
      } catch {
        user = undefined;
      }
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      finishOAuthLogin(oauthToken, user).then(() => toast.success("소셜 로그인 성공!"));
      return;
    }

    if (oauthError) {
      handledOAuthRef.current = true;
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      toast.error("소셜 로그인에 실패했습니다");
      return;
    }

    if (!handledOAuthRef.current) {
      fetchMe();
    }
  }, [fetchMe, finishOAuthLogin]);

  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
  }, [theme]);

  const renderPage = () => {
    switch (activeTab) {
      case "home": return <HomePage onTabChange={setActiveTab} />;
      case "markets": return <MarketsPage />;
      case "chart": return <ChartPage />;
      case "news": return <NewsPage />;
      case "portfolio": return <PortfolioPage />;
      case "options": return <OptionsPage />;
      case "orders": return <OrdersPage />;
      case "ai": return <AIPage />;
      case "monitor": return <MonitorPage />;
      case "admin": return <AdminPage />;
      default: return <HomePage onTabChange={setActiveTab} />;
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
        <div className="relative min-w-0 flex-1 overflow-hidden">
          <button
            type="button"
            onClick={() => setMobileWatchlistOpen(true)}
            className="absolute bottom-20 right-3 z-20 inline-flex items-center gap-1 rounded-full border border-terminal-border bg-terminal-panel/95 px-3 py-1.5 text-[11px] font-mono text-terminal-text-secondary shadow-sm backdrop-blur md:hidden"
          >
            <Star size={12} className="text-terminal-yellow" />
            관심종목
          </button>
          {renderPage()}
        </div>
      </main>
      {mobileWatchlistOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <button
            type="button"
            aria-label="관심종목 닫기"
            onClick={() => setMobileWatchlistOpen(false)}
            className="absolute inset-0 bg-black/35"
          />
          <section className="absolute bottom-0 left-0 right-0 flex max-h-[82vh] flex-col overflow-hidden rounded-t-2xl border border-terminal-border bg-terminal-panel shadow-2xl">
            <div className="flex items-center justify-between border-b border-terminal-border px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-terminal-text-primary">관심종목</div>
                <div className="text-[11px] text-terminal-text-dim">모바일에서는 필요할 때만 열어 메인 화면을 넓게 써요.</div>
              </div>
              <button
                type="button"
                onClick={() => setMobileWatchlistOpen(false)}
                className="rounded-full border border-terminal-border p-2 text-terminal-text-secondary"
              >
                <X size={14} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <WatchList />
            </div>
          </section>
        </div>
      )}
      <MobileTabBar activeTab={activeTab} onTabChange={setActiveTab} />

      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: theme === "light" ? "#ffffff" : "#111111",
            color: theme === "light" ? "#0f172a" : "#e0e0e0",
            border: theme === "light" ? "1px solid #d8dbe6" : "1px solid #1a1a1a",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "11px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          },
          success: { iconTheme: { primary: "#16a34a", secondary: "#fff" } },
          error: { iconTheme: { primary: "#b91c1c", secondary: "#fff" } },
        }}
      />
    </div>
  );
}
