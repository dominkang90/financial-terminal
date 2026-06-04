import { useState } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { portfolioApi } from "@/api/client";
import { useMarketStore } from "@/store/marketStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useAuthStore } from "@/store/authStore";
import { formatNumber } from "@/components/common/DataStatus";
import toast from "react-hot-toast";

export function OrderPanel() {
  const { activeSymbol, quotes } = useMarketStore();
  const { enableRealTrading } = useSettingsStore();
  const { user } = useAuthStore();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  const quote = quotes[activeSymbol];
  const currentPrice = quote?.price ?? 0;
  const execPrice = orderType === "market" ? currentPrice : parseFloat(price || "0");
  const total = (parseFloat(qty || "0") * execPrice).toFixed(2);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      const message = "주문하려면 먼저 로그인해야 합니다. 로그인 창을 열어드릴게요.";
      setAuthNotice(message);
      toast.error(message);
      window.dispatchEvent(new Event("open-auth-modal"));
      return;
    }

    setAuthNotice(null);

    const isPaper = !enableRealTrading;

    if (!isPaper) {
      const confirmed = window.confirm(
        `⚠️ 실제 주문입니다!\n${side === "buy" ? "매수" : "매도"} ${qty}주 × $${execPrice} = $${total}\n계속 진행하시겠습니까?`
      );
      if (!confirmed) return;
    }

    setIsSubmitting(true);
    try {
      // 기본 포트폴리오 ID (1번으로 임시 처리)
      await portfolioApi.trade({
        portfolio_id: 1,
        symbol: activeSymbol,
        side,
        quantity: parseFloat(qty),
        price: execPrice,
        is_paper: isPaper,
      });

      toast.success(
        isPaper
          ? `[PAPER] ${side === "buy" ? "매수" : "매도"} 주문 체결됨`
          : `[실거래] ${side === "buy" ? "매수" : "매도"} 주문이 브로커에 전송되었습니다`
      );
      setQty("");
    } catch (err: unknown) {
      toast.error("주문 실패: " + (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "오류");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 + 모드 표시 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-terminal-border flex-shrink-0">
        <span className="text-xs font-mono text-terminal-text-secondary">주문</span>
        <div className="flex-1" />
        {enableRealTrading ? (
          <div className="flex items-center gap-1 px-2 py-0.5 bg-terminal-red/10 border border-terminal-red/40 rounded text-2xs font-mono text-terminal-red">
            <AlertTriangle size={9} />
            실거래 모드
          </div>
        ) : (
          <div className="flex items-center gap-1 px-2 py-0.5 bg-terminal-yellow/10 border border-terminal-yellow/40 rounded text-2xs font-mono text-terminal-yellow">
            <ShieldCheck size={9} />
            PAPER TRADING
          </div>
        )}
      </div>

      <form onSubmit={submit} className="p-3 space-y-3">
        {/* 종목 */}
        <div className="flex items-center justify-between">
          <span className="text-2xs text-terminal-text-dim font-mono">종목</span>
          <span className="text-sm font-bold font-mono text-terminal-accent">{activeSymbol}</span>
        </div>

        {/* 현재가 */}
        <div className="flex items-center justify-between">
          <span className="text-2xs text-terminal-text-dim font-mono">현재가</span>
          <span className="text-xs font-mono text-terminal-text-primary">
            {quote ? `$${formatNumber(currentPrice)}` : "데이터 없음"}
          </span>
        </div>

        {/* 매수/매도 */}
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => setSide("buy")}
            className={`py-1.5 text-xs font-mono rounded font-semibold transition-colors ${
              side === "buy"
                ? "bg-terminal-green text-black"
                : "border border-terminal-border text-terminal-text-secondary hover:border-terminal-green hover:text-terminal-green"
            }`}
          >
            매수 (BUY)
          </button>
          <button
            type="button"
            onClick={() => setSide("sell")}
            className={`py-1.5 text-xs font-mono rounded font-semibold transition-colors ${
              side === "sell"
                ? "bg-terminal-red text-white"
                : "border border-terminal-border text-terminal-text-secondary hover:border-terminal-red hover:text-terminal-red"
            }`}
          >
            매도 (SELL)
          </button>
        </div>

        {/* 주문 유형 */}
        <div className="space-y-1">
          <label className="text-2xs text-terminal-text-dim font-mono">주문 유형</label>
          <div className="flex gap-1">
            {(["market", "limit"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setOrderType(t)}
                className={`px-2 py-0.5 text-2xs font-mono rounded border ${
                  orderType === t
                    ? "border-terminal-accent text-terminal-accent bg-terminal-accent/10"
                    : "border-terminal-border text-terminal-text-dim hover:border-terminal-text-secondary"
                }`}
              >
                {t === "market" ? "시장가" : "지정가"}
              </button>
            ))}
          </div>
        </div>

        {/* 수량 */}
        <div className="space-y-1">
          <label className="text-2xs text-terminal-text-dim font-mono">수량 (주)</label>
          <input
            type="number"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            min="0.001"
            step="0.001"
            required
            placeholder="0"
            className="w-full bg-terminal-bg border border-terminal-border rounded px-2.5 py-1.5 text-xs font-mono text-terminal-text-primary outline-none focus:border-terminal-accent"
          />
        </div>

        {/* 지정가 */}
        {orderType === "limit" && (
          <div className="space-y-1">
            <label className="text-2xs text-terminal-text-dim font-mono">지정가 ($)</label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              min="0"
              step="0.01"
              required
              placeholder={String(currentPrice)}
              className="w-full bg-terminal-bg border border-terminal-border rounded px-2.5 py-1.5 text-xs font-mono text-terminal-text-primary outline-none focus:border-terminal-accent"
            />
          </div>
        )}

        {/* 예상 금액 */}
        <div className="flex items-center justify-between p-2 bg-terminal-bg border border-terminal-border rounded">
          <span className="text-2xs text-terminal-text-dim font-mono">예상 금액</span>
          <span className="text-xs font-mono text-terminal-text-primary font-semibold">${total}</span>
        </div>

        {!user && authNotice && (
          <div className="rounded border border-terminal-red/40 bg-terminal-red/10 px-2.5 py-2 text-2xs font-mono text-terminal-red">
            {authNotice}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !qty}
          className={`w-full py-2 text-xs font-mono font-semibold rounded transition-colors disabled:opacity-40 ${
            side === "buy"
              ? "bg-terminal-green text-black hover:bg-green-500"
              : "bg-terminal-red text-white hover:bg-red-600"
          }`}
        >
          {isSubmitting
            ? "처리 중..."
            : `${enableRealTrading ? "실거래" : "[PAPER]"} ${side === "buy" ? "매수" : "매도"}`
          }
        </button>

        {!enableRealTrading && (
          <p className="text-2xs text-terminal-text-dim font-mono text-center">
            모의 거래 모드입니다. 설정에서 실거래를 활성화할 수 있습니다.
          </p>
        )}
      </form>
    </div>
  );
}
