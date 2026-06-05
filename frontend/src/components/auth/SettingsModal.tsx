import { useState } from "react";
import { X, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { useSettingsStore } from "@/store/settingsStore";
import toast from "react-hot-toast";

interface Props {
  onClose: () => void;
}

export function SettingsModal({ onClose }: Props) {
  const settings = useSettingsStore();
  const [gemini, setGemini] = useState(settings.geminiApiKey);
  const [finnhub, setFinnhub] = useState(settings.finnhubApiKey);
  const [alpacaKey, setAlpacaKey] = useState(settings.alpacaApiKey);
  const [alpacaSecret, setAlpacaSecret] = useState(settings.alpacaSecretKey);
  const [enableReal, setEnableReal] = useState(settings.enableRealTrading);
  const [refreshInterval, setRefreshInterval] = useState(settings.autoRefreshInterval);
  const [defaultQuoteDisplay, setDefaultQuoteDisplay] = useState(settings.defaultQuoteDisplay);
  const [showKeys, setShowKeys] = useState(false);
  const [tab, setTab] = useState<"api" | "trading" | "display">("api");

  const save = () => {
    settings.setGeminiKey(gemini);
    settings.setFinnhubKey(finnhub);
    settings.setAlpacaKeys(alpacaKey, alpacaSecret);
    settings.setEnableRealTrading(enableReal);
    settings.setAutoRefreshInterval(refreshInterval);
    settings.setDefaultQuoteDisplay(defaultQuoteDisplay);
    toast.success("설정이 저장되었습니다");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-terminal-panel border border-terminal-border rounded-lg w-full max-w-lg mx-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-terminal-border">
          <h2 className="text-sm font-semibold text-terminal-text-primary font-mono">설정</h2>
          <button onClick={onClose} className="text-terminal-text-dim hover:text-terminal-text-primary">
            <X size={14} />
          </button>
        </div>

        {/* 탭 */}
        <div className="flex border-b border-terminal-border">
          {(["api", "trading", "display"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-xs font-mono ${tab === t ? "border-b-2 border-terminal-accent text-terminal-accent" : "text-terminal-text-secondary hover:text-terminal-text-primary"}`}
            >
              {t === "api" ? "API 키" : t === "trading" ? "거래 설정" : "화면 설정"}
            </button>
          ))}
        </div>

        <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
          {tab === "api" && (
            <>
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => setShowKeys(!showKeys)}
                  className="flex items-center gap-1 text-2xs text-terminal-text-dim hover:text-terminal-text-primary font-mono"
                >
                  {showKeys ? <EyeOff size={10} /> : <Eye size={10} />}
                  {showKeys ? "키 숨기기" : "키 표시"}
                </button>
              </div>

              <ApiKeyField
                label="Gemini API 키"
                description="AI 분석 및 뉴스 번역에 사용 (없으면 규칙 기반 분석 사용)"
                link="https://aistudio.google.com/apikey"
                value={gemini}
                onChange={setGemini}
                show={showKeys}
              />
              <ApiKeyField
                label="Finnhub API 키"
                description="더 많은 뉴스 및 금융 데이터 (없으면 Yahoo Finance RSS 사용)"
                link="https://finnhub.io"
                value={finnhub}
                onChange={setFinnhub}
                show={showKeys}
              />
              <ApiKeyField
                label="Alpaca API 키"
                description="브로커 연동 (Paper Trading 및 실거래)"
                link="https://alpaca.markets"
                value={alpacaKey}
                onChange={setAlpacaKey}
                show={showKeys}
              />
              {alpacaKey && (
                <ApiKeyField
                  label="Alpaca Secret"
                  description=""
                  value={alpacaSecret}
                  onChange={setAlpacaSecret}
                  show={showKeys}
                />
              )}

              <div className="p-3 bg-terminal-bg border border-terminal-border rounded text-2xs text-terminal-text-dim font-mono">
                ⚠️ API 키는 브라우저 localStorage에 저장됩니다. 공용 PC에서는 사용 후 로그아웃하세요.
              </div>
            </>
          )}

          {tab === "trading" && (
            <>
              <div className="space-y-1">
                <label className="text-2xs text-terminal-text-dim font-mono uppercase">실거래 연동</label>
                <div className="flex items-center gap-3 p-3 bg-terminal-bg border border-terminal-border rounded">
                  <input
                    type="checkbox"
                    checked={enableReal}
                    onChange={(e) => setEnableReal(e.target.checked)}
                    className="accent-terminal-accent"
                  />
                  <div>
                    <div className="text-xs text-terminal-text-primary font-mono">실제 브로커 주문 활성화</div>
                    <div className="text-2xs text-terminal-text-dim">기본값: Paper Trading 모드</div>
                  </div>
                </div>
                {enableReal && (
                  <div className="flex items-center gap-2 p-2 bg-terminal-red/10 border border-terminal-red/30 rounded">
                    <AlertTriangle size={12} className="text-terminal-red flex-shrink-0" />
                    <span className="text-2xs text-terminal-red font-mono">실거래 모드가 활성화되었습니다. 주문 시 실제 돈이 사용됩니다!</span>
                  </div>
                )}
              </div>
            </>
          )}

          {tab === "display" && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-2xs text-terminal-text-dim font-mono uppercase">자동 새로고침 주기</label>
                <select
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(Number(e.target.value))}
                  className="bg-terminal-bg border border-terminal-border rounded px-2 py-1.5 text-xs font-mono text-terminal-text-primary outline-none focus:border-terminal-accent w-full"
                >
                  <option value={10}>10초</option>
                  <option value={30}>30초</option>
                  <option value={60}>1분</option>
                  <option value={300}>5분</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-2xs text-terminal-text-dim font-mono uppercase">기본 가격 표시 통화</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDefaultQuoteDisplay("KRW")}
                    className={`rounded border px-3 py-2 text-xs font-mono text-left ${
                      defaultQuoteDisplay === "KRW"
                        ? "border-terminal-accent bg-terminal-accent/10 text-terminal-accent"
                        : "border-terminal-border text-terminal-text-secondary hover:text-terminal-text-primary"
                    }`}
                  >
                    원화 우선
                    <div className="mt-1 text-2xs text-terminal-text-dim">해외주식도 KRW 환산값을 기본으로 표시</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDefaultQuoteDisplay("NATIVE")}
                    className={`rounded border px-3 py-2 text-xs font-mono text-left ${
                      defaultQuoteDisplay === "NATIVE"
                        ? "border-terminal-accent bg-terminal-accent/10 text-terminal-accent"
                        : "border-terminal-border text-terminal-text-secondary hover:text-terminal-text-primary"
                    }`}
                  >
                    달러/현지통화 우선
                    <div className="mt-1 text-2xs text-terminal-text-dim">원래 통화를 기본으로 보고 필요할 때만 KRW로 전환</div>
                  </button>
                </div>
                <p className="text-2xs text-terminal-text-dim">종목 상세 패널에서는 종목별로 원화/달러(현지통화) 버튼을 따로 바꿀 수 있습니다.</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-terminal-border">
          <button onClick={onClose} className="px-3 py-1.5 text-xs font-mono text-terminal-text-secondary border border-terminal-border rounded hover:border-terminal-text-primary">
            취소
          </button>
          <button onClick={save} className="px-3 py-1.5 text-xs font-mono bg-terminal-accent text-black rounded hover:bg-terminal-accent-dim font-semibold">
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

function ApiKeyField({
  label, description, link, value, onChange, show,
}: {
  label: string; description: string; link?: string;
  value: string; onChange: (v: string) => void; show: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <label className="text-2xs text-terminal-text-dim font-mono uppercase flex-1">{label}</label>
        {link && (
          <a href={link} target="_blank" rel="noopener noreferrer" className="text-2xs text-terminal-blue hover:underline font-mono">
            발급받기 ↗
          </a>
        )}
      </div>
      {description && <p className="text-2xs text-terminal-text-dim">{description}</p>}
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="키를 입력하세요"
        className="w-full bg-terminal-bg border border-terminal-border rounded px-2.5 py-1.5 text-xs font-mono text-terminal-text-primary placeholder-terminal-text-dim outline-none focus:border-terminal-accent"
      />
    </div>
  );
}
