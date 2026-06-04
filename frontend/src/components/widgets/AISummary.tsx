import { useEffect, useState } from "react";
import { Sparkles, RefreshCw } from "lucide-react";
import { aiApi } from "@/api/client";
import { useMarketStore } from "@/store/marketStore";
import { useSettingsStore } from "@/store/settingsStore";

export function AISummary() {
  const { activeSymbol } = useMarketStore();
  const { geminiApiKey } = useSettingsStore();
  const [summary, setSummary] = useState<string>("");
  const [method, setMethod] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const fetchSummary = async () => {
    setIsLoading(true);
    try {
      const res = await aiApi.analyze(activeSymbol, geminiApiKey || undefined);
      setSummary(res.analysis || "");
      setMethod(res.method || "");
    } catch {
      setSummary("분석 중 오류가 발생했습니다.");
      setMethod("error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setSummary("");
    fetchSummary();
  }, [activeSymbol]);

  const methodLabel =
    method === "gemini" ? "Gemini" :
    method === "rule_based" || method === "rule_based_fallback" ? "규칙 기반" :
    method === "error" ? "오류" : "";

  return (
    <div className="border-t border-terminal-border">
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-terminal-header">
        <Sparkles size={10} className="text-terminal-accent" />
        <span className="text-2xs font-mono text-terminal-text-dim uppercase tracking-wider flex-1">
          AI 요약
        </span>
        {methodLabel && (
          <span className="text-2xs font-mono text-terminal-blue bg-terminal-blue/10 px-1 rounded">
            {methodLabel}
          </span>
        )}
        <button
          onClick={fetchSummary}
          disabled={isLoading}
          className="text-terminal-text-dim hover:text-terminal-accent disabled:opacity-30"
          title="새로고침"
        >
          <RefreshCw size={9} className={isLoading ? "animate-spin" : ""} />
        </button>
      </div>
      <div className="px-3 py-2 text-2xs text-terminal-text-secondary font-mono whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
        {isLoading && !summary ? (
          <span className="text-terminal-text-dim">분석 중...</span>
        ) : (
          summary || "분석 데이터 없음"
        )}
      </div>
    </div>
  );
}
