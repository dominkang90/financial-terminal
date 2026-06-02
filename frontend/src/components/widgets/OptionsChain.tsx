import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { marketApi } from "@/api/client";
import type { OptionsChain, OptionContract } from "@/types";
import { useMarketStore } from "@/store/marketStore";
import { formatNumber } from "@/components/common/DataStatus";

export function OptionsChainWidget() {
  const { activeSymbol } = useMarketStore();
  const [data, setData] = useState<OptionsChain | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<"calls" | "puts">("calls");
  const [selectedExp, setSelectedExp] = useState<string>("");

  const load = async () => {
    setIsLoading(true);
    try {
      const res = await marketApi.options(activeSymbol);
      setData(res);
      if (res.selected_expiration) setSelectedExp(res.selected_expiration);
    } catch {
      setData(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [activeSymbol]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw size={16} className="animate-spin text-terminal-text-dim" />
      </div>
    );
  }

  if (!data || data.data_status === "no_data") {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-2">
          <p className="text-xs text-terminal-text-dim font-mono">{activeSymbol} 옵션 데이터 없음</p>
          <button onClick={load} className="text-2xs text-terminal-accent font-mono">다시 시도</button>
        </div>
      </div>
    );
  }

  if (data.data_status === "error") {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-xs text-terminal-red font-mono">{data.error || "오류"}</p>
      </div>
    );
  }

  const contracts: OptionContract[] = mode === "calls" ? (data.calls || []) : (data.puts || []);

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-terminal-border flex-shrink-0 flex-wrap gap-y-1">
        <span className="text-xs font-mono text-terminal-accent">{activeSymbol}</span>
        <span className="text-xs font-mono text-terminal-text-secondary">옵션 체인</span>

        <div className="flex gap-1">
          {["calls", "puts"].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m as "calls" | "puts")}
              className={`px-2 py-0.5 text-2xs font-mono rounded ${
                mode === m
                  ? m === "calls" ? "bg-terminal-green/20 text-terminal-green border border-terminal-green/40"
                    : "bg-terminal-red/20 text-terminal-red border border-terminal-red/40"
                  : "text-terminal-text-dim border border-terminal-border hover:bg-terminal-border"
              }`}
            >
              {m === "calls" ? "콜 (CALL)" : "풋 (PUT)"}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* 만기일 선택 */}
        {data.expirations.length > 0 && (
          <select
            value={selectedExp}
            onChange={(e) => setSelectedExp(e.target.value)}
            className="bg-terminal-bg border border-terminal-border rounded px-2 py-0.5 text-2xs font-mono text-terminal-text-primary outline-none focus:border-terminal-accent"
          >
            {data.expirations.slice(0, 8).map((exp) => (
              <option key={exp} value={exp}>{exp}</option>
            ))}
          </select>
        )}

        <button onClick={load} className="text-terminal-text-dim hover:text-terminal-text-primary">
          <RefreshCw size={11} />
        </button>
      </div>

      {/* 옵션 테이블 */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-2xs font-mono min-w-max">
          <thead>
            <tr className="border-b border-terminal-border bg-terminal-header sticky top-0">
              <th className="px-2 py-1.5 text-left text-terminal-text-dim">행사가</th>
              <th className="px-2 py-1.5 text-right text-terminal-text-dim">최종가</th>
              <th className="px-2 py-1.5 text-right text-terminal-text-dim">매수</th>
              <th className="px-2 py-1.5 text-right text-terminal-text-dim">매도</th>
              <th className="px-2 py-1.5 text-right text-terminal-text-dim">거래량</th>
              <th className="px-2 py-1.5 text-right text-terminal-text-dim">미결제</th>
              <th className="px-2 py-1.5 text-right text-terminal-text-dim">IV</th>
              <th className="px-2 py-1.5 text-right text-terminal-text-dim">등락</th>
            </tr>
          </thead>
          <tbody>
            {contracts.slice(0, 40).map((c, i) => (
              <tr
                key={i}
                className={`border-b border-terminal-border/50 hover:bg-terminal-border/30 ${
                  c.inTheMoney ? "bg-terminal-accent/5" : ""
                }`}
              >
                <td className="px-2 py-1 font-semibold text-terminal-text-primary">
                  ${formatNumber(c.strike, 0)}
                  {c.inTheMoney && <span className="ml-1 text-terminal-yellow text-2xs">ITM</span>}
                </td>
                <td className="px-2 py-1 text-right">${formatNumber(c.lastPrice)}</td>
                <td className="px-2 py-1 text-right text-terminal-green">${formatNumber(c.bid)}</td>
                <td className="px-2 py-1 text-right text-terminal-red">${formatNumber(c.ask)}</td>
                <td className="px-2 py-1 text-right">{c.volume?.toLocaleString()}</td>
                <td className="px-2 py-1 text-right">{c.openInterest?.toLocaleString()}</td>
                <td className="px-2 py-1 text-right">{((c.impliedVolatility ?? 0) * 100).toFixed(1)}%</td>
                <td className={`px-2 py-1 text-right ${c.change >= 0 ? "text-terminal-green" : "text-terminal-red"}`}>
                  {c.change >= 0 ? "+" : ""}{formatNumber(c.change)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-3 py-1 border-t border-terminal-border flex-shrink-0">
        <span className="text-2xs text-terminal-text-dim font-mono">yfinance 지연 데이터 · 투자 권유 아님</span>
      </div>
    </div>
  );
}
