import { useEffect, useRef, useState } from "react";
import {
  createChart, ColorType,
  type IChartApi, type ISeriesApi, type Time,
} from "lightweight-charts";
import { useMarketStore } from "@/store/marketStore";
import type { ChartPeriod, ChartInterval } from "@/types";
import { ChangeValue, formatNumber } from "@/components/common/DataStatus";

const PERIODS: ChartPeriod[] = ["1mo", "3mo", "6mo", "1y", "2y", "5y", "10y"];
const INTERVALS: ChartInterval[] = ["1d", "1wk", "1mo"];

const PERIOD_LABELS: Record<ChartPeriod, string> = {
  "1mo": "1M", "3mo": "3M", "6mo": "6M",
  "1y": "1Y", "2y": "2Y", "5y": "5Y", "10y": "10Y",
};
const INTERVAL_LABELS: Record<ChartInterval, string> = {
  "1d": "일봉", "1wk": "주봉", "1mo": "월봉",
};

function calcSMA(data: number[], period: number): (number | null)[] {
  return data.map((_, i) => {
    if (i < period - 1) return null;
    return data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
  });
}

export function StockChart() {
  const {
    activeSymbol, chartData, chartPeriod, chartInterval,
    setChartPeriod, setChartInterval, isLoadingChart, quotes,
  } = useMarketStore();

  const chartRef = useRef<HTMLDivElement>(null);
  const chartApi = useRef<IChartApi | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candleSeriesRef = useRef<ISeriesApi<any> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const volSeriesRef = useRef<ISeriesApi<any> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ma20Ref = useRef<ISeriesApi<any> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ma60Ref = useRef<ISeriesApi<any> | null>(null);

  const [showMA, setShowMA] = useState(true);
  const [showVol, setShowVol] = useState(true);

  // 차트 초기화
  useEffect(() => {
    if (!chartRef.current) return;

    chartApi.current = createChart(chartRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#0d0d0d" },
        textColor: "#888888",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: "#1a1a1a" },
        horzLines: { color: "#1a1a1a" },
      },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: "#1a1a1a" },
      timeScale: { borderColor: "#1a1a1a", timeVisible: true },
      width: chartRef.current.clientWidth,
      height: chartRef.current.clientHeight,
    });

    candleSeriesRef.current = chartApi.current.addCandlestickSeries({
      upColor: "#00cc44",
      downColor: "#ff3333",
      borderUpColor: "#00cc44",
      borderDownColor: "#ff3333",
      wickUpColor: "#00cc44",
      wickDownColor: "#ff3333",
    });

    volSeriesRef.current = chartApi.current.addHistogramSeries({
      color: "#1a1a1a",
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    chartApi.current.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });

    ma20Ref.current = chartApi.current.addLineSeries({
      color: "#ffcc00",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    ma60Ref.current = chartApi.current.addLineSeries({
      color: "#3399ff",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const observer = new ResizeObserver(() => {
      if (chartRef.current && chartApi.current) {
        chartApi.current.applyOptions({
          width: chartRef.current.clientWidth,
          height: chartRef.current.clientHeight,
        });
      }
    });
    observer.observe(chartRef.current);

    return () => {
      observer.disconnect();
      chartApi.current?.remove();
    };
  }, []);

  // 데이터 업데이트
  useEffect(() => {
    if (!chartData || !candleSeriesRef.current || chartData.candles.length === 0) return;

    const candles = [...chartData.candles].sort((a, b) => a.time - b.time);

    const candleData = candles.map((c) => ({
      time: c.time as Time,
      open: c.open, high: c.high, low: c.low, close: c.close,
    }));

    const volData = candles.map((c) => ({
      time: c.time as Time,
      value: c.volume,
      color: c.close >= c.open ? "#00cc4430" : "#ff333330",
    }));

    candleSeriesRef.current.setData(candleData);

    if (showVol && volSeriesRef.current) volSeriesRef.current.setData(volData);

    if (showMA) {
      const closes = candles.map((c) => c.close);
      const sma20 = calcSMA(closes, 20);
      const sma60 = calcSMA(closes, 60);

      ma20Ref.current?.setData(
        candles
          .map((c, i) => sma20[i] !== null ? { time: c.time as Time, value: sma20[i]! } : null)
          .filter(Boolean) as { time: Time; value: number }[]
      );
      ma60Ref.current?.setData(
        candles
          .map((c, i) => sma60[i] !== null ? { time: c.time as Time, value: sma60[i]! } : null)
          .filter(Boolean) as { time: Time; value: number }[]
      );
    }

    chartApi.current?.timeScale().fitContent();
  }, [chartData, showMA, showVol]);

  const quote = quotes[activeSymbol];

  return (
    <div className="flex flex-col h-full bg-terminal-panel">
      {/* 헤더 */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-terminal-border flex-shrink-0 flex-wrap gap-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold font-mono text-terminal-accent">{activeSymbol}</span>
          {quote && (
            <>
              <span className="text-sm font-mono text-terminal-text-primary">
                {quote.currency === "KRW" ? "₩" : quote.currency === "JPY" ? "¥" : "$"}
                {formatNumber(quote.price, quote.currency === "KRW" || quote.currency === "JPY" ? 0 : 2)}
              </span>
              <ChangeValue value={quote.change_pct ?? 0} suffix="%" className="text-xs" />
            </>
          )}
        </div>

        <div className="flex-1" />

        {/* 기간 선택 */}
        <div className="flex items-center gap-0.5">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setChartPeriod(p)}
              className={`px-1.5 py-0.5 text-2xs font-mono rounded transition-colors ${
                chartPeriod === p
                  ? "bg-terminal-accent text-black font-semibold"
                  : "text-terminal-text-dim hover:text-terminal-text-primary hover:bg-terminal-border"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        {/* 인터벌 선택 */}
        <div className="flex items-center gap-0.5">
          {INTERVALS.map((i) => (
            <button
              key={i}
              onClick={() => setChartInterval(i)}
              className={`px-1.5 py-0.5 text-2xs font-mono rounded transition-colors ${
                chartInterval === i
                  ? "bg-terminal-blue/30 text-terminal-blue border border-terminal-blue/50"
                  : "text-terminal-text-dim hover:text-terminal-text-primary hover:bg-terminal-border"
              }`}
            >
              {INTERVAL_LABELS[i]}
            </button>
          ))}
        </div>

        {/* 지표 토글 */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowMA(!showMA)}
            className={`px-1.5 py-0.5 text-2xs font-mono rounded border transition-colors ${
              showMA
                ? "border-terminal-yellow text-terminal-yellow"
                : "border-terminal-border text-terminal-text-dim"
            }`}
          >
            MA
          </button>
          <button
            onClick={() => setShowVol(!showVol)}
            className={`px-1.5 py-0.5 text-2xs font-mono rounded border transition-colors ${
              showVol
                ? "border-terminal-blue text-terminal-blue"
                : "border-terminal-border text-terminal-text-dim"
            }`}
          >
            VOL
          </button>
        </div>
      </div>

      {/* 차트 영역 */}
      <div className="relative flex-1 min-h-0">
        {isLoadingChart && (
          <div className="absolute inset-0 flex items-center justify-center bg-terminal-panel/80 z-10">
            <div className="text-xs text-terminal-text-dim font-mono">차트 로딩 중...</div>
          </div>
        )}
        {chartData?.data_status === "error" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-xs text-terminal-text-dim font-mono text-center">
              <div>차트 데이터를 불러올 수 없습니다</div>
              <div className="text-2xs mt-1 text-terminal-red">{(chartData as { error?: string }).error}</div>
            </div>
          </div>
        )}
        <div ref={chartRef} className="w-full h-full" />
      </div>

      {/* 하단 지표 범례 */}
      <div className="flex items-center gap-3 px-3 py-1 border-t border-terminal-border flex-shrink-0">
        {showMA && (
          <>
            <div className="flex items-center gap-1">
              <div className="w-4 h-0.5 bg-terminal-yellow" />
              <span className="text-2xs text-terminal-text-dim font-mono">MA20</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-0.5 bg-terminal-blue" />
              <span className="text-2xs text-terminal-text-dim font-mono">MA60</span>
            </div>
          </>
        )}
        {chartData && (
          <span className="text-2xs text-terminal-text-dim font-mono ml-auto">
            {chartData.data_source} · 지연 데이터
          </span>
        )}
      </div>
    </div>
  );
}
