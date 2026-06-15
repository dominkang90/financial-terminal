import { useState, useRef, useEffect } from "react";
import { Send, Bot, RefreshCw, Sparkles } from "lucide-react";
import { aiApi } from "@/api/client";
import { useMarketStore } from "@/store/marketStore";
import { useSettingsStore } from "@/store/settingsStore";

interface AIEvidence {
  symbol?: string;
  method?: string;
  price?: number | null;
  currency?: string | null;
  price_source?: string;
  news_count?: number;
  news_titles?: string[];
  checked_at?: string;
  transcript_used?: boolean;
  transcript_note?: string;
  disclaimer?: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  method?: string;
  evidence?: AIEvidence;
}

function buildWelcomeMessage(symbol: string, hasGemini = false) {
  const mode = hasGemini ? "Gemini AI 분석 모드" : "기본 분석 모드";
  const basis = hasGemini
    ? "Gemini와 앱의 시장 데이터를 함께 참고합니다."
    : "Gemini가 연결되지 않아 규칙과 기본 지표 중심으로 답합니다.";
  return `안녕하세요! 저는 FinTerminal 분석 도우미입니다.\n\n현재 선택된 종목: **${symbol}**\n현재 모드: **${mode}**\n\n${basis}\n투자 추천이 아니라 참고용 설명입니다. 종목 분석, 뉴스 요약, 투자 개념 설명을 도와드릴게요.`;
}

function formatEvidenceTime(value?: string) {
  if (!value) return "방금 전";
  try {
    return new Date(value).toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "확인 시각 미상";
  }
}

function EvidenceBox({ evidence }: { evidence?: AIEvidence }) {
  if (!evidence) return null;
  const priceText = typeof evidence.price === "number"
    ? `${evidence.currency === "KRW" ? "₩" : "$"}${evidence.price.toLocaleString(undefined, { maximumFractionDigits: evidence.currency === "KRW" ? 0 : 2 })}`
    : "가격 확인 중";
  const rows = [
    ["사용한 가격", `${evidence.symbol || "선택 종목"} ${priceText} · ${evidence.price_source || "앱 시장 데이터"}`],
    ["사용한 뉴스", `${evidence.news_count ?? 0}개 확인${evidence.news_titles?.[0] ? ` · ${evidence.news_titles[0]}` : ""}`],
    ["기준 시각", `${formatEvidenceTime(evidence.checked_at)} KST`],
    ["자막 사용", evidence.transcript_used ? "사용함" : (evidence.transcript_note || "사용 안 함")],
    ["주의", evidence.disclaimer || "투자 추천이 아니라 참고용 설명입니다."],
  ];

  return (
    <div className="mt-2 rounded border border-terminal-accent/20 bg-terminal-accent/5 p-2">
      <div className="mb-1 text-[10px] font-mono font-semibold text-terminal-accent">AI 분석 근거</div>
      <div className="space-y-1">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[72px_1fr] gap-2 text-[10px] font-mono leading-4">
            <span className="text-terminal-text-dim">{label}</span>
            <span className="text-terminal-text-secondary">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AIAssistant() {
  const { activeSymbol } = useMarketStore();
  const { geminiApiKey } = useSettingsStore();
  const [serverGeminiConfigured, setServerGeminiConfigured] = useState(false);
  const hasGemini = Boolean(geminiApiKey || serverGeminiConfigured);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: buildWelcomeMessage(activeSymbol, hasGemini),
      method: "system",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    aiApi.status()
      .then((status) => setServerGeminiConfigured(Boolean(status.gemini_configured)))
      .catch(() => setServerGeminiConfigured(false));
  }, []);

  useEffect(() => {
    setMessages((prev) => {
      if (!prev[0] || prev[0].method !== "system") return prev;
      const next = [...prev];
      next[0] = { ...next[0], content: buildWelcomeMessage(activeSymbol, hasGemini) };
      return next;
    });
  }, [activeSymbol, hasGemini]);

  const send = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    try {
      const res = await aiApi.chat(text, activeSymbol, geminiApiKey || undefined);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.reply, method: res.method, evidence: res.evidence },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "죄송합니다, 오류가 발생했습니다. 잠시 후 다시 시도해주세요." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const analyzeSymbol = async () => {
    setIsAnalyzing(true);
    try {
      const res = await aiApi.analyze(activeSymbol, geminiApiKey || undefined);
      setMessages((prev) => [
        ...prev,
        { role: "user", content: `${activeSymbol} 종목 분석해줘` },
        { role: "assistant", content: res.analysis, method: res.method, evidence: res.evidence },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "분석 중 오류가 발생했습니다." },
      ]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-terminal-border flex-shrink-0">
        <Bot size={13} className="text-terminal-accent" />
        <span className="text-xs font-mono text-terminal-text-secondary">분석 도우미</span>
        <span className={`text-2xs font-mono px-1 rounded ${hasGemini ? "text-terminal-blue bg-terminal-blue/10" : "text-terminal-yellow bg-terminal-yellow/10"}`}>
          {hasGemini ? "Gemini AI 분석" : "기본 분석 모드"}
        </span>
        <div className="flex-1" />
        <button
          onClick={analyzeSymbol}
          disabled={isAnalyzing}
          className="flex items-center gap-1 px-2 py-0.5 text-2xs font-mono bg-terminal-accent/10 text-terminal-accent border border-terminal-accent/30 rounded hover:bg-terminal-accent/20 disabled:opacity-50"
        >
          <Sparkles size={9} />
          {isAnalyzing ? "분석 중..." : `${activeSymbol} 분석`}
        </button>
      </div>

      {/* 빠른 질문 */}
      {!hasGemini && (
        <div className="px-3 py-2 border-b border-terminal-border bg-terminal-yellow/5 text-[10px] font-mono text-terminal-yellow leading-relaxed">
          Gemini가 연결되지 않아 지금 답변은 기본 지표와 규칙 중심입니다. AI 분석처럼 보이지만, 실제 매매 판단은 원문 데이터와 함께 확인하세요.
        </div>
      )}

      {/* 빠른 질문 */}
      <div className="flex gap-1 px-3 py-1.5 border-b border-terminal-border flex-shrink-0 overflow-x-auto">
        {[
          "RSI란 무엇인가요?",
          "P/E 비율 해석 방법",
          `${activeSymbol} 52주 범위는?`,
          "배당주 투자 전략",
        ].map((q) => (
          <button
            key={q}
            onClick={() => send(q)}
            className="text-2xs font-mono text-terminal-text-dim hover:text-terminal-accent border border-terminal-border hover:border-terminal-accent/50 rounded px-2 py-0.5 flex-shrink-0 whitespace-nowrap transition-colors"
          >
            {q}
          </button>
        ))}
      </div>

      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[90%] rounded p-2.5 ${
                msg.role === "user"
                  ? "bg-terminal-accent/20 border border-terminal-accent/30"
                  : "bg-terminal-panel border border-terminal-border"
              }`}
            >
              {msg.role === "assistant" && (
                <div className="flex items-center gap-1 mb-1">
                  <Bot size={9} className="text-terminal-accent" />
                  <span className="text-2xs text-terminal-text-dim font-mono">
                    {msg.method === "gemini" ? "Gemini AI" : msg.method === "system" ? "시스템" : "규칙 기반"}
                  </span>
                </div>
              )}
              <p className="text-xs font-mono text-terminal-text-primary whitespace-pre-wrap leading-relaxed">
                {msg.content}
              </p>
              {msg.role === "assistant" && msg.method !== "system" && <EvidenceBox evidence={msg.evidence} />}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-terminal-panel border border-terminal-border rounded p-2.5">
              <div className="flex items-center gap-2">
                <RefreshCw size={10} className="text-terminal-accent animate-spin" />
                <span className="text-2xs text-terminal-text-dim font-mono">생각 중...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 입력 */}
      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="flex gap-2 px-3 py-2 border-t border-terminal-border flex-shrink-0"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="질문을 입력하세요... (예: AAPL 지금 사도 될까?)"
          disabled={isLoading}
          className="flex-1 bg-terminal-bg border border-terminal-border rounded px-2.5 py-1.5 text-xs font-mono text-terminal-text-primary placeholder-terminal-text-dim outline-none focus:border-terminal-accent disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="p-2 bg-terminal-accent text-black rounded hover:bg-terminal-accent-dim disabled:opacity-40 transition-colors"
        >
          <Send size={12} />
        </button>
      </form>
    </div>
  );
}
