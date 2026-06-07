import { useEffect, useState } from "react";
import { marketApi } from "@/api/client";

interface Fundamentals {
  name?: string;
  sector?: string;
  industry?: string;
  market_cap?: number;
  pe_trailing?: number;
  pe_forward?: number;
  pb_ratio?: number;
  ps_ratio?: number;
  ev_ebitda?: number;
  week52_high?: number;
  week52_low?: number;
  beta?: number;
  eps_trailing?: number;
  eps_forward?: number;
  earnings_dates?: string[];
  dividend_yield?: number;
  profit_margin?: number;
  operating_margin?: number;
  roe?: number;
  roa?: number;
  total_revenue?: number;
  debt_to_equity?: number;
  analyst_count?: number;
  recommendation_key?: string;
  recommendation_mean?: number;
  target_high?: number;
  target_low?: number;
  target_mean?: number;
  target_median?: number;
  rec_summary?: Record<string, number>;
}

function fmt(v: number | undefined, decimals = 2): string {
  if (v == null || isNaN(v)) return "—";
  return v.toFixed(decimals);
}

function fmtB(v: number | undefined): string {
  if (v == null || isNaN(v)) return "—";
  if (Math.abs(v) >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  return `$${v.toFixed(0)}`;
}

function fmtPct(v: number | undefined): string {
  if (v == null || isNaN(v)) return "—";
  return `${(v * 100).toFixed(2)}%`;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-[#1a1a1a]">
      <span className="text-2xs font-mono text-terminal-text-dim">{label}</span>
      <span className="text-2xs font-mono text-terminal-text-primary">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-[10px] font-mono text-terminal-accent uppercase tracking-widest mb-1 px-1">
        {title}
      </div>
      <div className="bg-[#111] border border-[#222] rounded-xl px-3 py-1">
        {children}
      </div>
    </div>
  );
}

const REC_LABEL: Record<string, string> = {
  strongBuy: "강력 매수",
  buy: "매수",
  hold: "중립",
  underperform: "약세",
  sell: "매도",
  strongSell: "강력 매도",
};

const REC_COLOR: Record<string, string> = {
  strongBuy: "text-terminal-green",
  buy: "text-terminal-green",
  hold: "text-terminal-yellow",
  underperform: "text-terminal-red",
  sell: "text-terminal-red",
  strongSell: "text-terminal-red",
};

export function StockInfoPanel({ symbol }: { symbol: string }) {
  const [data, setData] = useState<Fundamentals | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    setError(false);
    marketApi
      .fundamentals(symbol)
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [symbol]);

  if (loading) {
    return (
      <div className="p-6 text-center text-xs font-mono text-terminal-text-dim">
        {symbol} 종목정보 불러오는 중...
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="p-6 text-center text-xs font-mono text-terminal-text-dim">
        종목정보를 불러올 수 없습니다.
      </div>
    );
  }

  const recKey = data.recommendation_key ?? "";
  const recBars = data.rec_summary ?? {};
  const totalRec = Object.values(recBars).reduce((a, b) => a + b, 0);

  return (
    <div className="p-4 overflow-y-auto font-mono">
      {(data.sector || data.industry) && (
        <div className="text-[10px] text-terminal-text-dim mb-4">
          {data.sector} {data.industry ? `· ${data.industry}` : ""}
        </div>
      )}

      <Section title="밸류에이션">
        <Row label="시가총액" value={fmtB(data.market_cap)} />
        <Row label="PER (현재)" value={fmt(data.pe_trailing)} />
        <Row label="PER (예상)" value={fmt(data.pe_forward)} />
        <Row label="PBR" value={fmt(data.pb_ratio)} />
        <Row label="PSR" value={fmt(data.ps_ratio)} />
        <Row label="EV/EBITDA" value={fmt(data.ev_ebitda)} />
        <Row label="52주 최고" value={data.week52_high != null ? `$${fmt(data.week52_high)}` : "—"} />
        <Row label="52주 최저" value={data.week52_low != null ? `$${fmt(data.week52_low)}` : "—"} />
        <Row label="베타" value={fmt(data.beta)} />
      </Section>

      <Section title="재무 지표">
        <Row label="매출" value={fmtB(data.total_revenue)} />
        <Row label="EPS (현재)" value={data.eps_trailing != null ? `$${fmt(data.eps_trailing)}` : "—"} />
        <Row label="EPS (예상)" value={data.eps_forward != null ? `$${fmt(data.eps_forward)}` : "—"} />
        <Row label="순이익률" value={fmtPct(data.profit_margin)} />
        <Row label="영업이익률" value={fmtPct(data.operating_margin)} />
        <Row label="ROE" value={fmtPct(data.roe)} />
        <Row label="ROA" value={fmtPct(data.roa)} />
        <Row label="부채비율" value={fmt(data.debt_to_equity)} />
        {data.dividend_yield != null && data.dividend_yield > 0 && (
          <Row label="배당수익률" value={fmtPct(data.dividend_yield)} />
        )}
      </Section>

      <Section title="애널리스트 의견">
        {recKey && (
          <div className="flex items-center justify-between py-1.5 border-b border-[#1a1a1a]">
            <span className="text-2xs text-terminal-text-dim">컨센서스</span>
            <span className={`text-xs font-bold ${REC_COLOR[recKey] ?? "text-terminal-text-primary"}`}>
              {REC_LABEL[recKey] ?? recKey}
            </span>
          </div>
        )}
        {data.recommendation_mean != null && (
          <Row label="평균 점수 (1=강매수,5=강매도)" value={fmt(data.recommendation_mean)} />
        )}
        {data.analyst_count != null && (
          <Row label="분석가 수" value={`${data.analyst_count}명`} />
        )}
        {totalRec > 0 && (
          <div className="py-2">
            {(["strongBuy", "buy", "hold", "underperform", "sell"] as const).map((k) => {
              const count = (recBars as Record<string, number>)[k] ?? 0;
              if (count === 0) return null;
              const pct = (count / totalRec) * 100;
              return (
                <div key={k} className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-mono text-terminal-text-dim w-20 text-right">{REC_LABEL[k]}</span>
                  <div className="flex-1 bg-[#1a1a1a] rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${k.includes("Buy") || k === "buy" ? "bg-terminal-green" : k === "hold" ? "bg-terminal-yellow" : "bg-terminal-red"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-terminal-text-dim w-6">{count}</span>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="목표주가">
        <Row label="목표가 최고" value={data.target_high != null ? `$${fmt(data.target_high)}` : "—"} />
        <Row label="목표가 평균" value={data.target_mean != null ? `$${fmt(data.target_mean)}` : "—"} />
        <Row label="목표가 중간값" value={data.target_median != null ? `$${fmt(data.target_median)}` : "—"} />
        <Row label="목표가 최저" value={data.target_low != null ? `$${fmt(data.target_low)}` : "—"} />
      </Section>

      {data.earnings_dates && data.earnings_dates.length > 0 && (
        <Section title="실적 발표 일정">
          {data.earnings_dates.map((d, i) => (
            <Row key={i} label={i === 0 ? "다음 실적 발표" : `예정일 ${i + 1}`} value={d} />
          ))}
        </Section>
      )}
    </div>
  );
}
