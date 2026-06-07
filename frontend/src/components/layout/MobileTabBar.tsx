import { BarChart2, Bell, Briefcase, BookOpen, TrendingUp } from "lucide-react";
import type { TabId } from "@/types";

interface Props {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const MOBILE_TABS: { id: TabId; label: string; icon: typeof BarChart2 }[] = [
  { id: "markets", label: "시장", icon: TrendingUp },
  { id: "chart", label: "차트", icon: BarChart2 },
  { id: "news", label: "뉴스", icon: BookOpen },
  { id: "monitor", label: "감시", icon: Bell },
  { id: "portfolio", label: "포트폴리오", icon: Briefcase },
];

export function MobileTabBar({ activeTab, onTabChange }: Props) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0d0d0d] border-t border-[#1a1a1a] safe-area-bottom">
      <div className="flex items-stretch h-14">
        {MOBILE_TABS.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
                isActive ? "text-[#ff6600]" : "text-[#555] active:text-[#888]"
              }`}
            >
              <Icon size={18} strokeWidth={isActive ? 2.5 : 1.5} />
              <span className="text-2xs font-mono">{label}</span>
              {isActive && (
                <div className="absolute bottom-0 w-8 h-0.5 bg-[#ff6600] rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
