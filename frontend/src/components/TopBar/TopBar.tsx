import { useEffect, useState } from "react";
import {
  BarChart2, Briefcase, BookOpen, Wrench, Bot,
  LogIn, LogOut, Settings, Bell, User, ChevronDown,
} from "lucide-react";
import type { TabId } from "@/types";
import { useAuthStore } from "@/store/authStore";
import { CommandBar } from "./CommandBar";
import { IndexStrip } from "./IndexStrip";
import { AuthModal } from "@/components/auth/AuthModal";
import { SettingsModal } from "@/components/auth/SettingsModal";

interface TopBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export const NAV_ITEMS: { id: TabId; label: string; labelKo: string; icon: typeof BarChart2 }[] = [
  { id: "markets", label: "Markets", labelKo: "시장", icon: BarChart2 },
  { id: "chart", label: "Chart", labelKo: "차트", icon: BarChart2 },
  { id: "portfolio", label: "Portfolio", labelKo: "포트폴리오", icon: Briefcase },
  { id: "news", label: "News", labelKo: "뉴스", icon: BookOpen },
  { id: "monitor", label: "Monitor", labelKo: "감시", icon: Bell },
  { id: "options", label: "Options", labelKo: "옵션", icon: Wrench },
  { id: "orders", label: "Orders", labelKo: "주문", icon: Wrench },
  { id: "ai", label: "AI", labelKo: "AI", icon: Bot },
];

export function TopBar({ activeTab, onTabChange }: TopBarProps) {
  const { user, logout } = useAuthStore();
  const [showAuth, setShowAuth] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    const openAuthModal = () => setShowAuth(true);
    window.addEventListener("open-auth-modal", openAuthModal);
    return () => window.removeEventListener("open-auth-modal", openAuthModal);
  }, []);

  return (
    <div className="flex flex-col flex-shrink-0 bg-terminal-bg border-b border-terminal-border">
      {/* 최상단 메뉴 바 */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-terminal-border">
        {/* 로고 */}
        <div className="flex items-center gap-1.5 flex-shrink-0 mr-2">
          <div className="w-5 h-5 bg-terminal-accent flex items-center justify-center rounded-sm">
            <span className="text-black text-2xs font-bold font-mono">FT</span>
          </div>
          <span className="text-xs font-bold text-terminal-accent font-mono hidden sm:block">FinTerminal</span>
        </div>

        {/* 내비게이션 탭 - 데스크톱만 표시 */}
        <nav className="hidden md:flex items-center gap-0.5 flex-shrink-0">
          {NAV_ITEMS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className={`px-2.5 py-1 text-xs font-mono rounded-sm transition-colors ${
                activeTab === id
                  ? "bg-terminal-accent text-black font-semibold"
                  : "text-terminal-text-secondary hover:text-terminal-text-primary hover:bg-terminal-border"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="flex-1" />

        {/* 검색창 */}
        <CommandBar />

        <div className="flex-1" />

        {/* 우측 액션 */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => onTabChange("monitor")}
            className={`p-1.5 rounded hover:bg-terminal-border ${activeTab === "monitor" ? "text-terminal-accent" : "text-terminal-text-dim hover:text-terminal-text-primary"}`}
            title="실시간 감시판"
          >
            <Bell size={13} />
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-1.5 rounded hover:bg-terminal-border text-terminal-text-dim hover:text-terminal-text-primary"
          >
            <Settings size={13} />
          </button>

          {user ? (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-1 px-2 py-1 rounded border border-terminal-border hover:border-terminal-accent text-terminal-text-secondary hover:text-terminal-accent text-xs font-mono"
              >
                <User size={11} />
                <span className="hidden sm:block max-w-16 truncate">{user.username}</span>
                <ChevronDown size={10} />
              </button>
              {showUserMenu && (
                <div className="absolute right-0 top-full mt-1 w-40 bg-terminal-panel border border-terminal-border rounded shadow-xl z-50">
                  <div className="px-3 py-2 border-b border-terminal-border">
                    <div className="text-xs text-terminal-text-primary font-mono">{user.username}</div>
                    <div className="text-2xs text-terminal-text-dim">{user.email}</div>
                  </div>
                  <button
                    onClick={() => { setShowSettings(true); setShowUserMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-terminal-text-secondary hover:text-terminal-text-primary hover:bg-terminal-border"
                  >
                    <Settings size={11} />
                    설정
                  </button>
                  <button
                    onClick={() => { logout(); setShowUserMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-terminal-red hover:bg-terminal-border"
                  >
                    <LogOut size={11} />
                    로그아웃
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowAuth(true)}
              className="flex items-center gap-1 px-2 py-1 rounded border border-terminal-accent text-terminal-accent hover:bg-terminal-accent hover:text-black text-xs font-mono transition-colors"
            >
              <LogIn size={11} />
              로그인
            </button>
          )}
        </div>
      </div>

      {/* 지수 스트립 */}
      <IndexStrip />

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}
