import { useEffect, useState } from "react";
import { Toaster } from "react-hot-toast";
import type { TabId } from "@/types";
import { TopBar } from "@/components/TopBar/TopBar";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { MarketsPage } from "@/components/pages/MarketsPage";
import { ChartPage } from "@/components/pages/ChartPage";
import { NewsPage } from "@/components/pages/NewsPage";
import { PortfolioPage } from "@/components/pages/PortfolioPage";
import { OptionsPage } from "@/components/pages/OptionsPage";
import { OrdersPage } from "@/components/pages/OrdersPage";
import { AIPage } from "@/components/pages/AIPage";
import { useAuthStore } from "@/store/authStore";

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("markets");
  const { fetchMe } = useAuthStore();

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const renderPage = () => {
    switch (activeTab) {
      case "markets": return <MarketsPage />;
      case "chart": return <ChartPage />;
      case "news": return <NewsPage />;
      case "portfolio": return <PortfolioPage />;
      case "options": return <OptionsPage />;
      case "orders": return <OrdersPage />;
      case "ai": return <AIPage />;
      default: return <MarketsPage />;
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-terminal-bg text-terminal-text-primary">
      <TopBar activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="flex-1 overflow-hidden pb-14 md:pb-0">
        {renderPage()}
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
