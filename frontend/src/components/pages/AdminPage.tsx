import { useState, useEffect } from "react";
import {
  Shield, Activity, Settings2, Star, Key, RefreshCw,
  CheckCircle, XCircle, AlertCircle, Trash2, Plus, Sun, Moon,
} from "lucide-react";
import { useSettingsStore } from "@/store/settingsStore";
import { useMarketStore } from "@/store/marketStore";
import { useAuthStore } from "@/store/authStore";
import toast from "react-hot-toast";

type AdminTab = "status" | "settings" | "watchlist" | "apikeys";

const BACKEND = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function checkEndpoint(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

export function AdminPage() {
  const [tab, setTab] = useState<AdminTab>("status");

  return (
    <div className="flex flex-col h-full bg-terminal-bg overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-terminal-border bg-terminal-header flex-shrink-0">
        <Shield size={13} className="text-terminal-accent" />
        <span className="text-xs font-mono font-semibold text-terminal-text-primary">관리자 패널</span>
        <span className="ml-2 text-2xs text-terminal-text-dim font-mono">ADMIN</span>
      </div>

      {/* 탭 */}
      <div className="flex border-b border-terminal-border flex-shrink-0 bg-terminal-panel">
        {([
          { id: "status" as AdminTab, label: "시스템 현황", icon: Activity },
          { id: "settings" as AdminTab, label: "앱 설정", icon: Settings2 },
          { id: "watchlist" as AdminTab, label: "관심종목 관리", icon: Star },
          { id: "apikeys" as AdminTab, label: "API 키 관리", icon: Key },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-mono transition-colors border-b-2 ${
              tab === id
                ? "border-terminal-accent text-terminal-accent"
                : "border-transparent text-terminal-text-secondary hover:text-terminal-text-primary"
            }`}
          >
            <Icon size={11} />
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === "status" && <StatusTab />}
        {tab === "settings" && <AppSettingsTab />}
        {tab === "watchlist" && <WatchlistTab />}
        {tab === "apikeys" && <ApiKeysTab />}
      </div>
    </div>
  );
}

// ─── 시스템 현황 탭 ──────────────────────────────────────────────────────────

interface ServiceStatus {
  name: string;
  url: string;
  ok: boolean | null;
}

function StatusTab() {
  const [services, setServices] = useState<ServiceStatus[]>([
    { name: "백엔드 API", url: `${BACKEND}/api/health`, ok: null },
    { name: "시장 데이터 (yfinance)", url: `${BACKEND}/api/market/quote/AAPL`, ok: null },
    { name: "뉴스 API", url: `${BACKEND}/api/news`, ok: null },
  ]);
  const [checking, setChecking] = useState(false);

  const check = async () => {
    setChecking(true);
    const results = await Promise.all(
      services.map(async (s) => ({ ...s, ok: await checkEndpoint(s.url) }))
    );
    setServices(results);
    setChecking(false);
  };

  useEffect(() => { check(); }, []);

  const StatusIcon = ({ ok }: { ok: boolean | null }) => {
    if (ok === null) return <AlertCircle size={13} className="text-terminal-yellow" />;
    return ok
      ? <CheckCircle size={13} className="text-terminal-green" />
      : <XCircle size={13} className="text-terminal-red" />;
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-mono font-semibold text-terminal-text-primary uppercase tracking-wide">서비스 연결 상태</h3>
        <button
          onClick={check}
          disabled={checking}
          className="flex items-center gap-1 text-2xs font-mono text-terminal-text-dim hover:text-terminal-accent disabled:opacity-50"
        >
          <RefreshCw size={10} className={checking ? "animate-spin" : ""} />
          새로고침
        </button>
      </div>

      <div className="border border-terminal-border rounded overflow-hidden">
        {services.map((s, i) => (
          <div
            key={s.name}
            className={`flex items-center justify-between px-4 py-3 ${i < services.length - 1 ? "border-b border-terminal-border" : ""}`}
          >
            <div>
              <div className="text-xs font-mono text-terminal-text-primary">{s.name}</div>
              <div className="text-2xs text-terminal-text-dim font-mono">{s.url}</div>
            </div>
            <div className="flex items-center gap-1.5">
              <StatusIcon ok={s.ok} />
              <span className={`text-2xs font-mono ${
                s.ok === null ? "text-terminal-yellow" : s.ok ? "text-terminal-green" : "text-terminal-red"
              }`}>
                {s.ok === null ? "확인 중..." : s.ok ? "정상" : "오류"}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 border border-terminal-border rounded bg-terminal-panel">
        <div className="text-2xs font-mono text-terminal-text-dim leading-relaxed">
          <div className="font-semibold text-terminal-text-secondary mb-1">환경 정보</div>
          <div>프론트엔드: {window.location.origin}</div>
          <div>백엔드: {BACKEND}</div>
          <div>빌드: {import.meta.env.MODE}</div>
        </div>
      </div>
    </div>
  );
}

// ─── 앱 설정 탭 ──────────────────────────────────────────────────────────────

function AppSettingsTab() {
  const settings = useSettingsStore();

  return (
    <div className="space-y-5 max-w-lg">
      <Section title="화면">
        <RowToggle
          label="테마"
          description="다크 / 라이트 모드 전환"
          icon={settings.theme === "dark" ? <Moon size={12} /> : <Sun size={12} />}
          checked={settings.theme === "light"}
          onChange={(v) => settings.setTheme(v ? "light" : "dark")}
          trueLabel="라이트"
          falseLabel="다크"
        />
      </Section>

      <Section title="데이터 새로고침">
        <div className="space-y-1">
          <label className="text-2xs text-terminal-text-dim font-mono uppercase">자동 새로고침 주기</label>
          <select
            value={settings.autoRefreshInterval}
            onChange={(e) => settings.setAutoRefreshInterval(Number(e.target.value))}
            className="w-full bg-terminal-bg border border-terminal-border rounded px-2.5 py-1.5 text-xs font-mono text-terminal-text-primary outline-none focus:border-terminal-accent"
          >
            <option value={10}>10초</option>
            <option value={30}>30초 (권장)</option>
            <option value={60}>1분</option>
            <option value={300}>5분</option>
          </select>
        </div>
      </Section>

      <Section title="가격 표시">
        <div className="grid grid-cols-2 gap-2">
          {(["KRW", "NATIVE"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => settings.setDefaultQuoteDisplay(mode)}
              className={`rounded border px-3 py-2 text-xs font-mono text-left transition-colors ${
                settings.defaultQuoteDisplay === mode
                  ? "border-terminal-accent bg-terminal-accent/10 text-terminal-accent"
                  : "border-terminal-border text-terminal-text-secondary hover:border-terminal-text-secondary"
              }`}
            >
              {mode === "KRW" ? "원화 우선" : "달러 / 현지통화 우선"}
              <div className="text-2xs text-terminal-text-dim mt-0.5">
                {mode === "KRW" ? "해외 주식도 KRW로 환산" : "현지 통화 기본 표시"}
              </div>
            </button>
          ))}
        </div>
      </Section>

      <Section title="거래 설정">
        <RowToggle
          label="실거래 모드"
          description="활성화 시 Alpaca 실계좌 주문이 발생합니다"
          checked={settings.enableRealTrading}
          onChange={settings.setEnableRealTrading}
          danger={settings.enableRealTrading}
        />
      </Section>
    </div>
  );
}

// ─── 관심종목 관리 탭 ─────────────────────────────────────────────────────────

const QUICK_ADD_LIST = ["AAPL","MSFT","GOOGL","AMZN","NVDA","TSLA","META","PLTR","005930","035420"];

function WatchlistTab() {
  const { watchlist, addToWatchlist, removeFromWatchlist } = useMarketStore();
  const [input, setInput] = useState("");

  const handleAdd = (sym: string) => {
    const s = sym.trim().toUpperCase();
    if (s && !watchlist.includes(s)) {
      addToWatchlist(s);
      toast.success(`${s} 추가됨`);
    }
    setInput("");
  };

  const handleRemove = (sym: string) => {
    removeFromWatchlist(sym);
    toast.success(`${sym} 삭제됨`);
  };

  return (
    <div className="space-y-4 max-w-lg">
      <Section title="빠른 추가">
        <div className="flex flex-wrap gap-1.5">
          {QUICK_ADD_LIST.map((sym) => (
            <button
              key={sym}
              onClick={() => handleAdd(sym)}
              disabled={watchlist.includes(sym)}
              className={`px-2 py-0.5 text-2xs font-mono rounded border transition-colors ${
                watchlist.includes(sym)
                  ? "border-terminal-border text-terminal-text-dim opacity-40 cursor-not-allowed"
                  : "border-terminal-accent text-terminal-accent hover:bg-terminal-accent hover:text-black"
              }`}
            >
              {watchlist.includes(sym) ? "✓ " : "+ "}{sym}
            </button>
          ))}
        </div>
      </Section>

      <Section title="직접 추가">
        <form
          onSubmit={(e) => { e.preventDefault(); handleAdd(input); }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="종목 코드 입력 (예: TSLA, 005930)"
            className="flex-1 bg-terminal-bg border border-terminal-border rounded px-2.5 py-1.5 text-xs font-mono text-terminal-text-primary placeholder-terminal-text-dim outline-none focus:border-terminal-accent"
          />
          <button
            type="submit"
            className="flex items-center gap-1 px-3 py-1.5 bg-terminal-accent hover:bg-terminal-accent-dim text-black text-xs font-mono font-semibold rounded transition-colors"
          >
            <Plus size={11} />
            추가
          </button>
        </form>
      </Section>

      <Section title={`현재 관심종목 (${watchlist.length}개)`}>
        {watchlist.length === 0 ? (
          <p className="text-2xs text-terminal-text-dim font-mono">관심종목이 없습니다</p>
        ) : (
          <div className="border border-terminal-border rounded overflow-hidden">
            {watchlist.map((sym, i) => (
              <div
                key={sym}
                className={`flex items-center justify-between px-3 py-2 ${i < watchlist.length - 1 ? "border-b border-terminal-border" : ""}`}
              >
                <span className="text-xs font-mono text-terminal-text-primary">{sym}</span>
                <button
                  onClick={() => handleRemove(sym)}
                  className="flex items-center gap-1 text-2xs text-terminal-text-dim hover:text-terminal-red font-mono transition-colors"
                >
                  <Trash2 size={11} />
                  삭제
                </button>
              </div>
            ))}
          </div>
        )}
        {watchlist.length > 0 && (
          <button
            onClick={() => {
              watchlist.forEach((s) => removeFromWatchlist(s));
              toast.success("전체 삭제 완료");
            }}
            className="mt-2 text-2xs text-terminal-red hover:underline font-mono"
          >
            전체 삭제
          </button>
        )}
      </Section>
    </div>
  );
}

// ─── API 키 관리 탭 ──────────────────────────────────────────────────────────

function ApiKeysTab() {
  const settings = useSettingsStore();
  const [gemini, setGemini] = useState(settings.geminiApiKey);
  const [finnhub, setFinnhub] = useState(settings.finnhubApiKey);
  const [alpacaKey, setAlpacaKey] = useState(settings.alpacaApiKey);
  const [alpacaSecret, setAlpacaSecret] = useState(settings.alpacaSecretKey);
  const [show, setShow] = useState(false);

  const save = () => {
    settings.setGeminiKey(gemini);
    settings.setFinnhubKey(finnhub);
    settings.setAlpacaKeys(alpacaKey, alpacaSecret);
    toast.success("API 키가 저장되었습니다");
  };

  return (
    <div className="space-y-4 max-w-lg">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-mono font-semibold text-terminal-text-primary uppercase tracking-wide">API 키 설정</h3>
        <button
          onClick={() => setShow(!show)}
          className="text-2xs text-terminal-text-dim hover:text-terminal-accent font-mono"
        >
          {show ? "숨기기" : "보이기"}
        </button>
      </div>

      <div className="p-3 border border-terminal-yellow/40 bg-terminal-yellow/5 rounded text-2xs text-terminal-yellow font-mono">
        ⚠️ API 키는 브라우저 localStorage에 저장됩니다. 공용 PC 사용 시 로그아웃하세요.
      </div>

      {[
        { label: "Gemini API 키", desc: "AI 분석·뉴스 번역", link: "https://aistudio.google.com/apikey", val: gemini, set: setGemini },
        { label: "Finnhub API 키", desc: "추가 뉴스 및 데이터", link: "https://finnhub.io", val: finnhub, set: setFinnhub },
        { label: "Alpaca API 키", desc: "브로커 연동 (거래)", link: "https://alpaca.markets", val: alpacaKey, set: setAlpacaKey },
        { label: "Alpaca Secret", desc: "", val: alpacaSecret, set: setAlpacaSecret },
      ].map(({ label, desc, link, val, set }) => (
        <div key={label} className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-2xs text-terminal-text-dim font-mono uppercase">{label}</span>
            {link && (
              <a href={link} target="_blank" rel="noopener noreferrer" className="text-2xs text-terminal-blue hover:underline font-mono">
                발급받기 ↗
              </a>
            )}
          </div>
          {desc && <p className="text-2xs text-terminal-text-dim">{desc}</p>}
          <input
            type={show ? "text" : "password"}
            value={val}
            onChange={(e) => set(e.target.value)}
            placeholder="키를 입력하세요"
            className="w-full bg-terminal-bg border border-terminal-border rounded px-2.5 py-1.5 text-xs font-mono text-terminal-text-primary placeholder-terminal-text-dim outline-none focus:border-terminal-accent"
          />
        </div>
      ))}

      <button
        onClick={save}
        className="px-4 py-2 bg-terminal-accent hover:bg-terminal-accent-dim text-black text-xs font-mono font-semibold rounded transition-colors"
      >
        저장
      </button>
    </div>
  );
}

// ─── 공통 컴포넌트 ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="text-2xs font-mono font-semibold text-terminal-text-dim uppercase tracking-widest border-b border-terminal-border pb-1">
        {title}
      </h4>
      {children}
    </div>
  );
}

function RowToggle({
  label, description, icon, checked, onChange, trueLabel, falseLabel, danger,
}: {
  label: string;
  description: string;
  icon?: React.ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  trueLabel?: string;
  falseLabel?: string;
  danger?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between p-3 border rounded ${danger ? "border-terminal-red/40 bg-terminal-red/5" : "border-terminal-border"}`}>
      <div className="flex items-center gap-2">
        {icon && <span className="text-terminal-text-secondary">{icon}</span>}
        <div>
          <div className="text-xs font-mono text-terminal-text-primary">{label}</div>
          {description && <div className="text-2xs text-terminal-text-dim">{description}</div>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {(trueLabel || falseLabel) && (
          <span className="text-2xs font-mono text-terminal-text-secondary">{checked ? trueLabel : falseLabel}</span>
        )}
        <button
          type="button"
          onClick={() => onChange(!checked)}
          className={`relative w-9 h-5 rounded-full transition-colors ${checked ? (danger ? "bg-terminal-red" : "bg-terminal-accent") : "bg-terminal-border"}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-4" : ""}`} />
        </button>
      </div>
    </div>
  );
}
