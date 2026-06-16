import { useEffect, useMemo, useState } from "react";
import { Bell, Plus, RefreshCcw, Target, Trash2, Megaphone } from "lucide-react";
import { useMarketStore } from "@/store/marketStore";
import { ChangeValue, DataFreshnessLine, MissingValue, formatNumber } from "@/components/common/DataStatus";
import { StockIdentity } from "@/components/common/StockIdentity";

const STORAGE_KEY = "price-monitor-alerts";

type AlertDirection = "above" | "below";

interface PriceAlert {
  id: string;
  symbol: string;
  target: number;
  direction: AlertDirection;
}

function loadAlerts(): PriceAlert[] {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(saved)) return [];
    return saved.filter((item): item is PriceAlert => (
      typeof item.id === "string" &&
      typeof item.symbol === "string" &&
      typeof item.target === "number" &&
      (item.direction === "above" || item.direction === "below")
    ));
  } catch {
    return [];
  }
}

function getAlertStatus(alert: PriceAlert, price?: number) {
  if (typeof price !== "number") return "waiting";
  if (alert.direction === "above") return price >= alert.target ? "hit" : "watching";
  return price <= alert.target ? "hit" : "watching";
}

function alertUsefulness(alert: PriceAlert, price?: number) {
  if (typeof price !== "number") return "현재가가 들어오면 목표가와 거리를 계산해요.";
  const distance = Math.abs((alert.target - price) / price) * 100;
  if (distance < 1) return "설정가와 아주 가까워요. 알림이 오면 관련 정보를 차분히 확인해요.";
  if (distance < 5) return "가까운 기준이라 자주 확인하지 않아도 흐름을 놓치지 않게 도와줘요.";
  return "거리가 있어 자주 울리기보다 큰 변화가 생겼는지 확인하는 용도예요.";
}

function AlertGuideCard() {
  const guides = [
    ["무엇을 알려요?", "목표가 도달, 하루 3% 이상 급변, 가격 데이터 없음처럼 확인이 필요한 변화만 보여줘요."],
    ["얼마나 자주 봐요?", "관심종목 가격은 30초마다 확인하고, 같은 목표가 알림은 한 번만 울려요."],
    ["왜 쓸모 있나요?", "가격을 계속 쳐다보지 않고, 내가 정한 기준에 가까워졌을 때 다시 볼 수 있어요."],
  ];

  return (
    <div className="rounded border border-terminal-accent/25 bg-terminal-accent/5 p-2">
      <div className="mb-2 text-[10px] font-mono text-terminal-accent">초보자용 알림 안내</div>
      <div className="grid gap-2">
        {guides.map(([label, value]) => (
          <div key={label} className="rounded border border-terminal-border bg-terminal-bg/45 px-2 py-1.5">
            <div className="text-[10px] font-mono text-terminal-text-primary">{label}</div>
            <div className="mt-0.5 text-[10px] leading-4 text-terminal-text-dim">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MonitorPage() {
  const { watchlist, quotes, activeSymbol, setActiveSymbol, fetchWatchlistQuotes } = useMarketStore();
  const [alerts, setAlerts] = useState<PriceAlert[]>(() => loadAlerts());
  const [symbolInput, setSymbolInput] = useState(activeSymbol);
  const [targetInput, setTargetInput] = useState("");
  const [direction, setDirection] = useState<AlertDirection>("above");
  const [notifiedIds, setNotifiedIds] = useState<Set<string>>(() => new Set());
  const [lastCheckedAt, setLastCheckedAt] = useState("");
  const canUseNotification = typeof window !== "undefined" && "Notification" in window;
  const notificationPermission = canUseNotification ? Notification.permission : "unsupported";

  useEffect(() => {
    const refresh = () => {
      fetchWatchlistQuotes();
      setLastCheckedAt(new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }));
    };
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [fetchWatchlistQuotes]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
  }, [alerts]);

  const monitorRows = useMemo(() => {
    return watchlist
      .map((symbol) => ({ symbol, quote: quotes[symbol] }))
      .sort((a, b) => Math.abs(b.quote?.change_pct ?? 0) - Math.abs(a.quote?.change_pct ?? 0));
  }, [quotes, watchlist]);

  const hitAlerts = useMemo(() => (
    alerts.filter((alert) => getAlertStatus(alert, quotes[alert.symbol]?.price) === "hit")
  ), [alerts, quotes]);


  useEffect(() => {
    hitAlerts.forEach((alert) => {
      if (notifiedIds.has(alert.id)) return;
      const quote = quotes[alert.symbol];
      if (notificationPermission === "granted") {
        new Notification(`FinTerminal 알림: ${alert.symbol}`, {
          body: `설정한 기준가 ${formatNumber(alert.target, 2)}에 도달했어요. 현재가 ${quote ? formatNumber(quote.price, 2) : "확인 중"}. 매매 신호가 아니라 확인 알림이에요.`,
        });
      }
      setNotifiedIds((prev) => new Set(prev).add(alert.id));
    });
  }, [hitAlerts, notifiedIds, notificationPermission, quotes]);

  const requestNotification = async () => {
    if (!canUseNotification || Notification.permission === "granted") return;
    await Notification.requestPermission();
  };

  const addAlert = (event: React.FormEvent) => {
    event.preventDefault();
    const symbol = symbolInput.trim().toUpperCase();
    const target = Number(targetInput);
    if (!symbol || Number.isNaN(target) || target <= 0) return;
    setAlerts((prev) => [
      ...prev,
      { id: `${symbol}-${Date.now()}`, symbol, target, direction },
    ]);
    setTargetInput("");
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-terminal-bg">
      <div className="flex flex-wrap items-center gap-3 border-b border-terminal-border bg-terminal-panel px-4 py-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-mono text-terminal-text-primary">
            <Bell size={15} className="text-terminal-accent" />
            실시간 감시판
          </div>
          <div className="mt-1 text-[11px] font-mono text-terminal-text-dim">
            관심종목을 30초마다 다시 읽고, 큰 움직임과 목표가 도달을 한곳에서 봅니다. 같은 목표가는 한 번만 알려드려요.
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            fetchWatchlistQuotes();
            setLastCheckedAt(new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }));
          }}
          className="ml-auto inline-flex items-center gap-1 rounded border border-terminal-border px-2 py-1 text-xs font-mono text-terminal-text-secondary hover:text-terminal-text-primary"
        >
          <RefreshCcw size={12} />
          새로고침
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto p-3 lg:grid-cols-[1fr_360px]">
        <section className="min-h-0 rounded border border-terminal-border bg-terminal-panel overflow-x-auto">
          <div className="grid grid-cols-[minmax(140px,1fr)_80px_80px_70px] min-w-[370px] border-b border-terminal-border px-3 py-2 text-[11px] font-mono text-terminal-text-dim">
            <span>관심종목</span>
            <span className="text-right">가격</span>
            <span className="text-right">등락률</span>
            <span className="text-right">상태</span>
          </div>
          <div className="divide-y divide-terminal-border/70 min-w-[370px]">
            {monitorRows.map(({ symbol, quote }) => {
              const move = Math.abs(quote?.change_pct ?? 0);
              const isHot = move >= 3;
              const isActive = symbol === activeSymbol;

              return (
                <button
                  key={symbol}
                  type="button"
                  onClick={() => setActiveSymbol(symbol)}
                  className={`grid w-full grid-cols-[minmax(140px,1fr)_80px_80px_70px] items-center px-3 py-3 text-left hover:bg-terminal-border/70 ${isActive ? "bg-terminal-accent/10" : ""}`}
                >
                  <StockIdentity symbol={symbol} quote={quote} active={isActive} subtitle={quote ? quote.exchange : "데이터 대기 중"} />
                  <div className="text-right text-xs font-mono text-terminal-text-primary">
                    {quote ? formatNumber(quote.price, 2) : <MissingValue label="확인 중" className="text-xs" />}
                  </div>
                  <div className="text-right">
                    {quote ? <ChangeValue value={quote.change_pct ?? 0} suffix="%" className="text-xs" /> : <MissingValue label="대기" className="text-xs" />}
                  </div>
                  <div className="text-right">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-mono ${isHot ? "bg-terminal-yellow/15 text-terminal-yellow" : "bg-terminal-bg text-terminal-text-dim"}`}>
                      {isHot ? "급변" : "감시"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="space-y-3">
          <section className="rounded border border-terminal-border bg-terminal-panel p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-mono text-terminal-text-primary">
              <Megaphone size={13} className="text-terminal-accent" />
              알림 센터
            </div>
            <div className="space-y-2 text-[11px] font-mono text-terminal-text-secondary">
              <div>관심종목 급등락, 목표가 도달, AI 확인 항목을 한곳에서 확인해요.</div>
              <div className="rounded border border-terminal-border bg-terminal-bg px-2 py-1 text-terminal-text-dim">
                현재 자동 감시: 목표가 도달 {hitAlerts.length}개 · 급변 종목 {monitorRows.filter(({ quote }) => Math.abs(quote?.change_pct ?? 0) >= 3).length}개 · 확인 주기 30초
                <DataFreshnessLine checkedAt={lastCheckedAt} source="관심종목 가격 제공처" status="delayed" className="mt-1" />
              </div>
              <AlertGuideCard />
              <div className="rounded border border-terminal-border bg-terminal-bg/40 px-2 py-1 leading-5 text-terminal-text-dim">
                알림은 매수·매도 신호가 아니에요. 설정한 가격에 가까워졌을 때 뉴스, 가격 흐름, 내 투자 목적을 다시 확인하도록 돕는 기능입니다.
              </div>
              {canUseNotification && notificationPermission !== "granted" && (
                <button
                  type="button"
                  onClick={requestNotification}
                  className="rounded border border-terminal-accent/40 px-2 py-1 text-terminal-accent hover:bg-terminal-accent/10"
                >
                  브라우저 알림 켜기
                </button>
              )}
              {notificationPermission === "granted" && <div className="text-terminal-green">브라우저 알림 켜짐</div>}
            </div>
          </section>

          <section className="rounded border border-terminal-border bg-terminal-panel">
            <div className="flex items-center gap-2 border-b border-terminal-border px-3 py-2 text-xs font-mono text-terminal-text-primary">
              <Target size={13} className="text-terminal-accent" />
              목표가 알림
              <span className="ml-auto text-[10px] text-terminal-text-dim">{hitAlerts.length}개 도달</span>
            </div>
            <div className="border-b border-terminal-border px-3 py-2 text-[11px] leading-5 text-terminal-text-dim">
              목표가는 “거래하라는 신호”가 아니라 “다시 확인할 가격”이에요. 알림이 오면 바로 행동하기보다 관련 정보와 내 기준을 함께 살펴보세요.
            </div>
            <form onSubmit={addAlert} className="space-y-2 border-b border-terminal-border p-3">
              <div className="grid grid-cols-[1fr_1fr] gap-2">
                <input
                  value={symbolInput}
                  onChange={(event) => setSymbolInput(event.target.value)}
                  className="rounded border border-terminal-border bg-terminal-bg px-2 py-1 text-xs font-mono text-terminal-text-primary outline-none focus:border-terminal-accent"
                  placeholder="종목 예: NVDA"
                />
                <input
                  value={targetInput}
                  onChange={(event) => setTargetInput(event.target.value)}
                  className="rounded border border-terminal-border bg-terminal-bg px-2 py-1 text-xs font-mono text-terminal-text-primary outline-none focus:border-terminal-accent"
                  placeholder="목표가"
                  inputMode="decimal"
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={direction}
                  onChange={(event) => setDirection(event.target.value as AlertDirection)}
                  className="flex-1 rounded border border-terminal-border bg-terminal-bg px-2 py-1 text-xs font-mono text-terminal-text-primary outline-none focus:border-terminal-accent"
                >
                  <option value="above">이 가격 이상</option>
                  <option value="below">이 가격 이하</option>
                </select>
                <button type="submit" className="inline-flex items-center gap-1 rounded bg-terminal-accent px-2 py-1 text-xs font-mono font-semibold text-black">
                  <Plus size={12} />
                  확인 알림 추가
                </button>
              </div>
            </form>

            <div className="max-h-[420px] overflow-y-auto">
              {alerts.length === 0 ? (
                <div className="p-3 text-xs font-mono text-terminal-text-dim">
                  아직 목표가 알림이 없습니다.
                </div>
              ) : alerts.map((alert) => {
                const quote = quotes[alert.symbol];
                const status = getAlertStatus(alert, quote?.price);
                return (
                  <div key={alert.id} className="flex items-center gap-2 border-b border-terminal-border/70 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-mono text-terminal-text-primary">{alert.symbol}</div>
                      <div className="text-[10px] font-mono text-terminal-text-dim">
                        현재 {quote ? formatNumber(quote.price, 2) : "확인 중"} · 목표 {alert.direction === "above" ? "이상" : "이하"} {formatNumber(alert.target, 2)}
                      </div>
                      <div className="mt-0.5 text-[10px] font-mono text-terminal-text-dim">
                        {alertUsefulness(alert, quote?.price)}
                      </div>
                    </div>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-mono ${status === "hit" ? "bg-terminal-green/15 text-terminal-green" : "bg-terminal-bg text-terminal-text-dim"}`}>
                      {status === "hit" ? "도달" : "대기"}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setAlerts((prev) => prev.filter((item) => item.id !== alert.id));
                        setNotifiedIds((prev) => { const next = new Set(prev); next.delete(alert.id); return next; });
                      }}
                      className="text-terminal-text-dim hover:text-terminal-red"
                      title="삭제"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
