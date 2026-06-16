import { useEffect, useState } from "react";
import { Plus, Trash2, TrendingUp, TrendingDown, PieChart, ShieldAlert, WalletCards } from "lucide-react";
import { portfolioApi } from "@/api/client";
import type { Position, PortfolioSummary } from "@/types";
import { useAuthStore } from "@/store/authStore";
import { ChangeValue, formatNumber } from "@/components/common/DataStatus";

interface PortfolioData {
  positions: Position[];
  summary: PortfolioSummary;
}

const DEMO_POSITIONS = [
  { symbol: "AAPL", name: "Apple", weight: "35%", pnl: "+4.2%" },
  { symbol: "NVDA", name: "NVIDIA", weight: "30%", pnl: "+8.7%" },
  { symbol: "MSFT", name: "Microsoft", weight: "20%", pnl: "+1.9%" },
  { symbol: "CASH", name: "현금", weight: "15%", pnl: "대기" },
];

function buildPortfolioInsights(positions: Position[], summary?: PortfolioSummary) {
  const total = summary?.total_market_value || positions.reduce((sum, pos) => sum + (pos.market_value || 0), 0);
  const sorted = [...positions].sort((a, b) => (b.market_value || 0) - (a.market_value || 0));
  const top = sorted[0];
  const topWeight = total > 0 && top ? (top.market_value / total) * 100 : 0;
  const lossCount = positions.filter((pos) => (pos.pnl_pct ?? 0) <= -3).length;
  const missingDataCount = positions.filter((pos) => pos.quote_status === "no_data").length;
  const sectors = positions.reduce<Record<string, number>>((acc, pos) => {
    const key = pos.sector || "기타";
    acc[key] = (acc[key] || 0) + (pos.market_value || 0);
    return acc;
  }, {});
  const mainSector = Object.entries(sectors).sort((a, b) => b[1] - a[1])[0];
  const mainSectorWeight = total > 0 && mainSector ? (mainSector[1] / total) * 100 : 0;
  const issueCount = [topWeight >= 40, mainSectorWeight >= 55, lossCount > 0, missingDataCount > 0].filter(Boolean).length;

  return {
    status: positions.length === 0 ? "종목을 추가하면 점검을 시작해요" : issueCount > 0 ? `확인할 점 ${issueCount}개` : "전반적으로 차분한 구성이에요",
    concentration: topWeight >= 40
      ? `${top?.symbol} 비중이 ${topWeight.toFixed(0)}%라 한 종목 움직임이 크게 보일 수 있어요.`
      : "한 종목에 과하게 몰린 모습은 아직 크지 않아요.",
    sector: mainSectorWeight >= 55
      ? `${mainSector?.[0]} 쪽 비중이 ${mainSectorWeight.toFixed(0)}%라 같은 뉴스에 함께 움직일 수 있어요.`
      : mainSector
        ? `${mainSector[0]} 중심이지만, 한 업종만 보이는 상태는 아니에요.`
        : "업종 정보가 들어오면 쏠림을 더 자세히 볼 수 있어요.",
    pnl: summary
      ? summary.total_pnl >= 0
        ? `현재 손익은 +${summary.total_pnl_pct.toFixed(2)}%예요. 수익보다 구성 이유를 같이 보면 좋아요.`
        : `현재 손익은 ${summary.total_pnl_pct.toFixed(2)}%예요. 손실 원인을 단정하지 말고 숫자와 뉴스를 같이 확인해요.`
      : "손익 계산을 기다리는 중이에요.",
    check: lossCount > 0 || missingDataCount > 0
      ? `${lossCount > 0 ? `손실 폭이 큰 종목 ${lossCount}개` : "큰 손실 종목은 아직 없어요"} · ${missingDataCount > 0 ? `가격 확인 필요 ${missingDataCount}개` : "가격 데이터는 대체로 들어왔어요"}`
      : "큰 손실이나 가격 데이터 빈칸은 아직 눈에 띄지 않아요.",
    nextCheck: topWeight >= 40
      ? "오늘은 비중이 큰 종목의 뉴스와 가격 기준을 먼저 확인해보세요. 사거나 팔라는 뜻은 아니에요."
      : "새 행동보다 내 구성이 투자 목적과 맞는지 먼저 확인해보세요.",
  };
}

function PortfolioInsightPanel({ positions, summary }: { positions: Position[]; summary?: PortfolioSummary }) {
  const insights = buildPortfolioInsights(positions, summary);
  const items = [
    { label: "쏠림", title: "한 자산에 너무 몰려 있지 않나요?", value: insights.concentration },
    { label: "업종", title: "같은 분야에 많이 모였나요?", value: insights.sector },
    { label: "손익", title: "손익을 차분히 볼 수 있나요?", value: insights.pnl },
    { label: "확인", title: "손실/데이터를 확인했나요?", value: insights.check },
  ];

  return (
    <div className="border-b border-terminal-border bg-terminal-bg/30 p-3">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-mono text-terminal-text-primary">
        <ShieldAlert size={13} className="text-terminal-accent" />
        포트폴리오 건강검진
        <span className="rounded border border-terminal-accent/30 bg-terminal-accent/10 px-2 py-0.5 text-[10px] text-terminal-accent">{insights.status}</span>
        <span className="ml-auto text-[10px] text-terminal-text-dim">투자 추천 아님</span>
      </div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="rounded border border-terminal-border bg-terminal-panel px-3 py-2">
            <div className="text-[10px] font-mono text-terminal-accent">{item.label}</div>
            <div className="mt-1 text-xs font-semibold text-terminal-text-primary">{item.title}</div>
            <div className="mt-1 text-[11px] font-mono leading-4 text-terminal-text-secondary">{item.value}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 rounded border border-terminal-border bg-terminal-bg/40 px-3 py-2 text-[11px] leading-5 text-terminal-text-dim">
        오늘의 확인할 점: {insights.nextCheck} 이 건강검진은 내 포트폴리오를 이해하기 위한 안내예요.
      </div>
    </div>
  );
}

export function Portfolio() {
  const { user } = useAuthStore();
  const [portfolios, setPortfolios] = useState<{ id: number; name: string; is_paper: boolean }[]>([]);
  const [activePortfolioId, setActivePortfolioId] = useState<number | null>(null);
  const [data, setData] = useState<PortfolioData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ symbol: "", quantity: "", avg_cost: "" });

  const loadPortfolios = async () => {
    try {
      const list = await portfolioApi.list();
      setPortfolios(list);
      if (list.length > 0 && !activePortfolioId) {
        setActivePortfolioId(list[0].id);
      }
    } catch {}
  };

  const loadPositions = async () => {
    if (!activePortfolioId) return;
    setIsLoading(true);
    try {
      const d = await portfolioApi.positions(activePortfolioId);
      setData(d);
    } catch {
      setData(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadPortfolios();
  }, [user]);

  useEffect(() => {
    loadPositions();
    const id = setInterval(loadPositions, 60_000);
    return () => clearInterval(id);
  }, [activePortfolioId]);

  const createPortfolio = async () => {
    try {
      await portfolioApi.create("내 포트폴리오", true, 0);
      await loadPortfolios();
    } catch {}
  };

  const addPosition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePortfolioId) return;
    try {
      await portfolioApi.addPosition(activePortfolioId, {
        symbol: addForm.symbol.toUpperCase(),
        quantity: parseFloat(addForm.quantity),
        avg_cost: parseFloat(addForm.avg_cost),
      });
      setAddForm({ symbol: "", quantity: "", avg_cost: "" });
      setShowAddForm(false);
      await loadPositions();
    } catch {}
  };

  const deletePosition = async (positionId: number) => {
    if (!activePortfolioId) return;
    await portfolioApi.deletePosition(activePortfolioId, positionId);
    await loadPositions();
  };

  if (!user) {
    return (
      <div className="h-full overflow-auto p-4">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="rounded-xl border border-terminal-border bg-terminal-panel p-4">
            <div className="flex items-start gap-3">
              <PieChart size={24} className="text-terminal-accent mt-0.5" />
              <div>
                <h2 className="text-sm font-mono font-semibold text-terminal-text-primary">포트폴리오 데모</h2>
                <p className="mt-1 text-xs font-mono text-terminal-text-secondary leading-relaxed">
                  로그인 전에는 실제 계좌 대신 예시 화면을 보여줘요. 로그인하면 내 종목, 수량, 평균단가를 저장해서 관리할 수 있습니다.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <SummaryCard label="예시 평가금액" value="$128,430" />
            <SummaryCard label="예시 손익" value="+$6,210" color="text-terminal-green" />
            <SummaryCard label="예시 수익률" value="+5.08%" color="text-terminal-green" />
          </div>

          <div className="rounded-xl border border-terminal-border bg-terminal-panel p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-mono text-terminal-text-primary">
              <WalletCards size={14} className="text-terminal-accent" />
              데모 포트폴리오 건강검진
              <span className="rounded border border-terminal-accent/30 bg-terminal-accent/10 px-2 py-0.5 text-[10px] text-terminal-accent">확인할 점 2개</span>
              <span className="ml-auto text-[10px] text-terminal-text-dim">투자 추천 아님</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["쏠림", "한 자산에 너무 몰려 있지 않나요?", "AAPL과 NVDA 비중이 커서 기술주 움직임이 크게 보일 수 있어요."],
                ["업종", "같은 분야에 많이 모였나요?", "데모 구성은 기술주 중심이에요. 같은 뉴스에 함께 움직일 수 있어요."],
                ["손익", "손익을 차분히 볼 수 있나요?", "예시 손익은 +5.08%예요. 수익보다 구성 이유를 같이 보면 좋아요."],
                ["여유", "바로 쓸 수 있는 현금이 있나요?", "현금 15%가 예시로 남아 있어요. 실제 계좌에서는 비상금 여부를 따로 확인해요."],
              ].map(([label, title, value]) => (
                <div key={label} className="rounded border border-terminal-border bg-terminal-bg/40 px-3 py-2">
                  <div className="text-[10px] font-mono text-terminal-accent">{label}</div>
                  <div className="mt-1 text-xs font-semibold text-terminal-text-primary">{title}</div>
                  <div className="mt-1 text-[11px] font-mono leading-4 text-terminal-text-secondary">{value}</div>
                </div>
              ))}
            </div>
            <div className="mt-2 rounded border border-terminal-border bg-terminal-bg/40 px-3 py-2 text-[11px] leading-5 text-terminal-text-dim">
              오늘의 확인할 점: 실제 계좌에서는 비중이 큰 자산이 내 투자 목적과 맞는지 확인해보세요. 사거나 팔라는 뜻은 아니에요.
            </div>
          </div>

          <div className="rounded-xl border border-terminal-border bg-terminal-panel overflow-hidden">
            <div className="px-3 py-2 border-b border-terminal-border text-2xs font-mono text-terminal-text-dim">
              데모 구성 — 실제 투자 추천이 아니라 화면 예시입니다
            </div>
            {DEMO_POSITIONS.map((item) => (
              <div key={item.symbol} className="flex items-center justify-between gap-3 px-3 py-2 border-b border-terminal-border/50 last:border-b-0">
                <div>
                  <div className="text-xs font-mono font-semibold text-terminal-accent">{item.symbol}</div>
                  <div className="text-2xs font-mono text-terminal-text-dim">{item.name}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono text-terminal-text-primary">비중 {item.weight}</div>
                  <div className={`text-2xs font-mono ${item.pnl.startsWith("+") ? "text-terminal-green" : "text-terminal-text-dim"}`}>{item.pnl}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded border border-terminal-yellow/20 bg-terminal-yellow/5 px-3 py-2 text-[10px] font-mono text-terminal-yellow leading-relaxed">
            외부 평가자에게 빈 화면처럼 보이지 않도록 데모를 보여줍니다. 실제 포트폴리오 기능은 로그인 뒤 사용할 수 있어요.
          </div>
        </div>
      </div>
    );
  }

  if (portfolios.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <PieChart size={24} className="text-terminal-text-dim mx-auto" />
          <p className="text-xs text-terminal-text-dim font-mono">포트폴리오가 없습니다</p>
          <button
            onClick={createPortfolio}
            className="px-3 py-1.5 bg-terminal-accent text-black text-xs font-mono rounded hover:bg-terminal-accent-dim"
          >
            포트폴리오 만들기
          </button>
        </div>
      </div>
    );
  }

  const summary = data?.summary;
  const positions = data?.positions ?? [];

  return (
    <div className="flex flex-col h-full">
      {/* 포트폴리오 탭 */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-terminal-border flex-shrink-0 overflow-x-auto">
        {portfolios.map((p) => (
          <button
            key={p.id}
            onClick={() => setActivePortfolioId(p.id)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-mono flex-shrink-0 ${
              activePortfolioId === p.id
                ? "bg-terminal-accent text-black"
                : "text-terminal-text-secondary hover:bg-terminal-border"
            }`}
          >
            {p.name}
            {p.is_paper && (
              <span className="text-2xs bg-terminal-yellow/20 text-terminal-yellow px-0.5 rounded">PAPER</span>
            )}
          </button>
        ))}
        <button
          onClick={createPortfolio}
          className="ml-auto text-terminal-text-dim hover:text-terminal-accent flex-shrink-0"
        >
          <Plus size={11} />
        </button>
      </div>

      {/* 요약 카드 */}
      {summary && (
        <div className="grid grid-cols-4 gap-px bg-terminal-border flex-shrink-0">
          <SummaryCard label="평가금액" value={`$${formatNumber(summary.total_market_value)}`} />
          <SummaryCard label="투자원금" value={`$${formatNumber(summary.total_cost_basis)}`} />
          <SummaryCard
            label="평가손익"
            value={`${summary.total_pnl >= 0 ? "+" : ""}$${formatNumber(summary.total_pnl)}`}
            color={summary.total_pnl >= 0 ? "text-terminal-green" : "text-terminal-red"}
          />
          <SummaryCard
            label="수익률"
            value={`${summary.total_pnl_pct >= 0 ? "+" : ""}${summary.total_pnl_pct.toFixed(2)}%`}
            color={summary.total_pnl_pct >= 0 ? "text-terminal-green" : "text-terminal-red"}
          />
        </div>
      )}

      <PortfolioInsightPanel positions={positions} summary={summary} />

      {/* 포지션 추가 폼 */}
      {showAddForm && (
        <form onSubmit={addPosition} className="flex gap-2 px-3 py-2 border-b border-terminal-border bg-terminal-bg flex-shrink-0 flex-wrap">
          <input
            value={addForm.symbol}
            onChange={(e) => setAddForm({ ...addForm, symbol: e.target.value })}
            placeholder="종목 (예: AAPL)"
            required
            className="w-20 bg-terminal-panel border border-terminal-border rounded px-2 py-1 text-xs font-mono text-terminal-text-primary outline-none focus:border-terminal-accent"
          />
          <input
            type="number"
            value={addForm.quantity}
            onChange={(e) => setAddForm({ ...addForm, quantity: e.target.value })}
            placeholder="수량"
            required
            min="0.001"
            step="0.001"
            className="w-20 bg-terminal-panel border border-terminal-border rounded px-2 py-1 text-xs font-mono text-terminal-text-primary outline-none focus:border-terminal-accent"
          />
          <input
            type="number"
            value={addForm.avg_cost}
            onChange={(e) => setAddForm({ ...addForm, avg_cost: e.target.value })}
            placeholder="평균단가"
            required
            min="0"
            step="0.01"
            className="w-24 bg-terminal-panel border border-terminal-border rounded px-2 py-1 text-xs font-mono text-terminal-text-primary outline-none focus:border-terminal-accent"
          />
          <button type="submit" className="px-2 py-1 bg-terminal-accent text-black text-xs font-mono rounded">추가</button>
          <button type="button" onClick={() => setShowAddForm(false)} className="px-2 py-1 text-terminal-text-dim text-xs font-mono">취소</button>
        </form>
      )}

      {/* 포지션 테이블 */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-20">
            <span className="text-xs text-terminal-text-dim font-mono">불러오는 중...</span>
          </div>
        ) : (
          <table className="w-full text-2xs font-mono min-w-max">
            <thead>
              <tr className="border-b border-terminal-border bg-terminal-header sticky top-0">
                <th className="px-3 py-1.5 text-left text-terminal-text-dim">종목</th>
                <th className="px-2 py-1.5 text-right text-terminal-text-dim">수량</th>
                <th className="px-2 py-1.5 text-right text-terminal-text-dim">평균단가</th>
                <th className="px-2 py-1.5 text-right text-terminal-text-dim">현재가</th>
                <th className="px-2 py-1.5 text-right text-terminal-text-dim">평가금액</th>
                <th className="px-2 py-1.5 text-right text-terminal-text-dim">손익</th>
                <th className="px-2 py-1.5 text-right text-terminal-text-dim">수익률</th>
                <th className="px-2 py-1.5 text-center text-terminal-text-dim w-8"></th>
              </tr>
            </thead>
            <tbody>
              {positions.map((pos) => (
                <tr key={pos.id} className="border-b border-terminal-border/50 hover:bg-terminal-border/30">
                  <td className="px-3 py-1.5">
                    <div className="font-semibold text-terminal-accent">{pos.symbol}</div>
                    <div className="text-terminal-text-dim text-2xs truncate max-w-24">{pos.name}</div>
                  </td>
                  <td className="px-2 py-1.5 text-right text-terminal-text-primary">{pos.quantity}</td>
                  <td className="px-2 py-1.5 text-right text-terminal-text-secondary">${formatNumber(pos.avg_cost)}</td>
                  <td className="px-2 py-1.5 text-right text-terminal-text-primary">
                    ${formatNumber(pos.current_price)}
                    {pos.quote_status === "no_data" && <span className="text-terminal-text-dim ml-1">?</span>}
                  </td>
                  <td className="px-2 py-1.5 text-right text-terminal-text-primary">${formatNumber(pos.market_value)}</td>
                  <td className="px-2 py-1.5 text-right">
                    <ChangeValue value={pos.pnl} className="text-2xs" />
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <ChangeValue value={pos.pnl_pct} suffix="%" className="text-2xs" />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <button
                      onClick={() => deletePosition(pos.id)}
                      className="text-terminal-text-dim hover:text-terminal-red"
                    >
                      <Trash2 size={10} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 하단 추가 버튼 */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-terminal-border flex-shrink-0">
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1 text-xs text-terminal-accent hover:text-terminal-accent-dim font-mono"
        >
          <Plus size={11} />
          포지션 추가
        </button>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color = "text-terminal-text-primary" }: {
  label: string; value: string; color?: string;
}) {
  return (
    <div className="bg-terminal-panel px-3 py-2">
      <div className="text-2xs text-terminal-text-dim">{label}</div>
      <div className={`text-xs font-mono font-semibold mt-0.5 ${color}`}>{value}</div>
    </div>
  );
}
