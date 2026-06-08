import { BarChart2, Bell, Briefcase, BookOpen, TrendingUp, Home } from "lucide-react";
import type { TabId } from "@/types";

interface Props {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const MOBILE_TABS: { id: TabId; label: string; icon: typeof BarChart2 }[] = [
  { id: "home", label: "홈", icon: Home },
  { id: "markets", label: "시장", icon: TrendingUp },
  { id: "chart", label: "차트", icon: BarChart2 },
  { id: "news", label: "뉴스", icon: BookOpen },
  { id: "monitor", label: "감시", icon: Bell },
  { id: "portfolio", label: "포트폴리오", icon: Briefcase },
];

export function MobileTabBar({ activeTab, onTabChange }: Props) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-terminal-panel border-t border-terminal-border safe-area-bottom">
      <div className="flex items-stretch h-14">
        {MOBILE_TABS.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
                isActive ? "text-terminal-accent" : "text-terminal-text-dim active:text-terminal-text-secondary"
              }`}
            >
              <Icon size={18} strokeWidth={isActive ? 2.5 : 1.5} />
              <span className="text-2xs font-mono">{label}</span>
              {isActive && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-terminal-accent rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
