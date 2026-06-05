import { useEffect } from "react";
import { useMarketStore } from "@/store/marketStore";
import { ChangeValue, formatNumber } from "@/components/common/DataStatus";

const SECTOR_ETFS: Record<string, string> = {
  "기술 (XLK)": "XLK",
  "헬스케어 (XLV)": "XLV",
  "금융 (XLF)": "XLF",
  "에너지 (XLE)": "XLE",
  "소비재 (XLY)": "XLY",
  "유틸리티 (XLU)": "XLU",
  "부동산 (XLRE)": "XLRE",
  "소재 (XLB)": "XLB",
};

export function MarketPulse() {
  const {
    quotes, fetchCommodities, fetchRates, commodities, rates, addToWatchlist,
    indices, fetchIndices, forex, fetchForex,
  } = useMarketStore();
  const { fetchWatchlistQuotes } = useMarketStore();

  useEffect(() => {
    // 섹터 ETF를 watchlist에 추가해서 quotes에 포함시킴
    Object.values(SECTOR_ETFS).forEach(sym => addToWatchlist(sym));
    fetchCommodities();
    fetchRates();
    fetchIndices();
    fetchForex();
    fetchWatchlistQuotes();
    const id = setInterval(() => {
      fetchCommodities();
      fetchRates();
      fetchIndices();
      fetchForex();
      fetchWatchlistQuotes();
    }, 60_000);
    return () => clearInterval(id);
  }, [fetchCommodities, fetchRates, fetchIndices, fetchForex, fetchWatchlistQuotes, addToWatchlist]);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* 한국 시장 */}
      <Section title="한국 시장">
        {Object.entries({
          "코스피 (KOSPI)": indices["KOSPI"],
          "코스닥 (KOSDAQ)": indices["KOSDAQ"],
          "원/달러": forex["USD/KRW"],
        }).map(([label, q]) => (
          <SectorRow key={label} label={label} q={q} pricePrefix="" />
        ))}
      </Section>

      {/* 섹터 ETF */}
      <Section title="섹터 모멘텀">
        {Object.entries(SECTOR_ETFS).map(([label, symbol]) => {
          const q = quotes[symbol];
          return (
            <SectorRow key={symbol} label={label} q={q} />
          );
        })}
      </Section>

      {/* 원자재 */}
      <Section title="원자재">
        {Object.entries({
          "금 (Gold)": commodities["GOLD"],
          "은 (Silver)": commodities["SILVER"],
          "WTI 원유": commodities["OIL_WTI"],
          "천연가스": commodities["NATGAS"],
          "구리": commodities["COPPER"],
        }).map(([label, q]) => (
          <SectorRow key={label} label={label} q={q} pricePrefix="" />
        ))}
      </Section>

      {/* 금리 */}
      <Section title="미국 금리">
        {Object.entries({
          "미국 10년물": rates["US10Y"],
          "미국 2년물": rates["US02Y"],
          "미국 30년물": rates["US30Y"],
        }).map(([label, q]) => (
          <SectorRow key={label} label={label} q={q} pricePrefix="" priceSuffix="%" />
        ))}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-terminal-border">
      <div className="px-3 py-1.5 bg-terminal-header">
        <span className="block whitespace-normal break-keep pr-1 text-[11px] leading-4 font-mono text-terminal-text-dim">
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

function SectorRow({
  label, q, pricePrefix = "$", priceSuffix = "",
}: {
  label: string;
  q: { price?: number; change_pct?: number; data_status?: string } | undefined;
  pricePrefix?: string;
  priceSuffix?: string;
}) {
  const pct = q?.change_pct ?? 0;
  const barWidth = Math.min(Math.abs(pct) * 10, 100);

  return (
    <div className="flex items-center gap-2 px-3 py-1 hover:bg-terminal-border group">
      <span className="text-2xs font-mono text-terminal-text-secondary flex-1 truncate">{label}</span>

      {/* 미니 바 차트 */}
      <div className="w-12 h-1.5 bg-terminal-border rounded-sm overflow-hidden">
        {q && q.data_status !== "error" && (
          <div
            className={`h-full rounded-sm ${pct >= 0 ? "bg-terminal-green" : "bg-terminal-red"}`}
            style={{ width: `${barWidth}%`, marginLeft: pct < 0 ? "auto" : undefined }}
          />
        )}
      </div>

      <div className="text-right w-16">
        {!q || q.data_status === "error" ? (
          <span className="text-2xs text-terminal-text-dim font-mono">—</span>
        ) : (
          <span className="text-2xs font-mono text-terminal-text-primary">
            {pricePrefix}{formatNumber(q.price, 2)}{priceSuffix}
          </span>
        )}
      </div>
      <div className="text-right w-12">
        {q && q.data_status !== "error" ? (
          <ChangeValue value={pct} suffix="%" className="text-2xs" />
        ) : (
          <span className="text-2xs text-terminal-text-dim font-mono">—</span>
        )}
      </div>
    </div>
  );
}
