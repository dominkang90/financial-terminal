import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Settings } from "lucide-react";
import { useMarketStore } from "@/store/marketStore";
import { marketApi } from "@/api/client";
import { ChangeValue, formatNumber } from "@/components/common/DataStatus";
import type { Quote } from "@/types";

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

const STORAGE_KEY = "market-pulse-order";
const DEFAULT_SECTION_ORDER = ["korea", "sectors", "commodities", "rates"] as const;
type SectionId = typeof DEFAULT_SECTION_ORDER[number];

function loadSectionOrder(): SectionId[] {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (Array.isArray(saved)) {
      const valid = saved.filter((id): id is SectionId => DEFAULT_SECTION_ORDER.includes(id));
      const missing = DEFAULT_SECTION_ORDER.filter((id) => !valid.includes(id));
      return [...valid, ...missing];
    }
  } catch {
    // ignore invalid localStorage state
  }
  return [...DEFAULT_SECTION_ORDER];
}

export function MarketPulse({ onCollapsedChange }: { onCollapsedChange?: (collapsed: boolean) => void }) {
  const {
    fetchCommodities, fetchRates, commodities, rates,
    indices, fetchIndices, forex, fetchForex,
  } = useMarketStore();
  const [collapsed, setCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sectionOrder, setSectionOrder] = useState<SectionId[]>(() => loadSectionOrder());
  const [sectorQuotes, setSectorQuotes] = useState<Record<string, Quote>>({});

  useEffect(() => {
    onCollapsedChange?.(collapsed);
  }, [collapsed, onCollapsedChange]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sectionOrder));
  }, [sectionOrder]);

  useEffect(() => {
    const syms = Object.values(SECTOR_ETFS);
    const fetchSectors = async () => {
      try {
        const data = await marketApi.batchQuotes(syms);
        setSectorQuotes(data);
      } catch {}
    };
    fetchSectors();
    fetchCommodities();
    fetchRates();
    fetchIndices();
    fetchForex();
    const id = setInterval(() => {
      fetchSectors();
      fetchCommodities();
      fetchRates();
      fetchIndices();
      fetchForex();
    }, 60_000);
    return () => clearInterval(id);
  }, [fetchCommodities, fetchRates, fetchIndices, fetchForex]);

  const sections = useMemo<Record<SectionId, { title: string; rows: ReactNode }>>(() => ({
    korea: {
      title: "한국 시장",
      rows: Object.entries({
        "코스피 (KOSPI)": indices["KOSPI"],
        "코스닥 (KOSDAQ)": indices["KOSDAQ"],
        "원/달러": forex["USD/KRW"],
      }).map(([label, q]) => <SectorRow key={label} label={label} q={q} pricePrefix="" />),
    },
    sectors: {
      title: "섹터 모멘텀",
      rows: Object.entries(SECTOR_ETFS).map(([label, symbol]) => (
        <SectorRow key={symbol} label={label} q={sectorQuotes[symbol]} />
      )),
    },
    commodities: {
      title: "원자재",
      rows: Object.entries({
        "금 (Gold)": commodities["GOLD"],
        "은 (Silver)": commodities["SILVER"],
        "WTI 원유": commodities["OIL_WTI"],
        "천연가스": commodities["NATGAS"],
        "구리": commodities["COPPER"],
      }).map(([label, q]) => <SectorRow key={label} label={label} q={q} pricePrefix="" />),
    },
    rates: {
      title: "미국 금리",
      rows: Object.entries({
        "미국 10년물": rates["US10Y"],
        "미국 2년물": rates["US02Y"],
        "미국 30년물": rates["US30Y"],
      }).map(([label, q]) => <SectorRow key={label} label={label} q={q} pricePrefix="" priceSuffix="%" />),
    },
  }), [commodities, forex, indices, sectorQuotes, rates]);

  const moveSection = (sectionId: SectionId, direction: -1 | 1) => {
    setSectionOrder((prev) => {
      const next = [...prev];
      const index = next.indexOf(sectionId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  if (collapsed) {
    return (
      <div className="flex h-full flex-col items-center gap-3 bg-[#0b0b0b] py-3">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="rounded border border-terminal-border p-1 text-terminal-text-secondary hover:text-terminal-text-primary"
          title="시장 모멘텀 열기"
        >
          <ChevronRight size={14} />
        </button>
        <div className="text-[10px] font-mono text-terminal-text-dim [writing-mode:vertical-rl]">시장 모멘텀</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#0b0b0b]">
      <div className="flex items-center justify-between border-b border-terminal-border px-2 py-1.5">
        <span className="text-2xs font-mono text-terminal-text-dim">시장 모멘텀 패널</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSettingsOpen((prev) => !prev)}
            className={`rounded border p-1 ${settingsOpen ? "border-[#ff6600]/50 text-[#ff8833]" : "border-terminal-border text-terminal-text-secondary hover:text-terminal-text-primary"}`}
            title="시장 모멘텀 순서 설정"
          >
            <Settings size={12} />
          </button>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="rounded border border-terminal-border p-1 text-terminal-text-secondary hover:text-terminal-text-primary"
            title="시장 모멘텀 닫기"
          >
            <ChevronLeft size={12} />
          </button>
        </div>
      </div>

      {settingsOpen && (
        <div className="border-b border-terminal-border bg-[#101010] px-2 py-2">
          <div className="mb-1 text-[10px] font-mono text-[#777]">표시 순서</div>
          <div className="space-y-1">
            {sectionOrder.map((sectionId, index) => (
              <div key={sectionId} className="flex items-center gap-1 rounded border border-[#222] px-1.5 py-1 text-[10px] font-mono text-[#aaa]">
                <span className="min-w-0 flex-1 truncate">{sections[sectionId].title}</span>
                <button type="button" onClick={() => moveSection(sectionId, -1)} disabled={index === 0} className="text-[#666] hover:text-[#ddd] disabled:opacity-25">
                  <ChevronUp size={11} />
                </button>
                <button type="button" onClick={() => moveSection(sectionId, 1)} disabled={index === sectionOrder.length - 1} className="text-[#666] hover:text-[#ddd] disabled:opacity-25">
                  <ChevronDown size={11} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {sectionOrder.map((sectionId) => (
          <Section key={sectionId} title={sections[sectionId].title}>
            {sections[sectionId].rows}
          </Section>
        ))}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-b border-terminal-border">
      <div className="px-3 py-1.5 bg-terminal-header">
        <span className="block whitespace-normal break-keep pr-1 text-[11px] leading-4 font-mono text-[#a6a6a6]">
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
  const hasData = q && q.data_status !== "error";

  return (
    <div className="px-3 py-1.5 hover:bg-terminal-border">
      <div className="flex items-center justify-between gap-1 mb-1">
        <span className="text-[10px] font-mono text-[#c9c9c9] truncate" title={label}>{label}</span>
        {hasData ? (
          <ChangeValue value={pct} suffix="%" className="text-[10px] shrink-0" />
        ) : (
          <span className="text-[10px] text-terminal-text-dim font-mono shrink-0">—</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1 bg-terminal-border rounded-sm overflow-hidden">
          {hasData && (
            <div
              className={`h-full rounded-sm ${pct >= 0 ? "bg-terminal-green" : "bg-terminal-red"}`}
              style={{ width: `${barWidth}%`, marginLeft: pct < 0 ? "auto" : undefined }}
            />
          )}
        </div>
        <span className="text-[10px] font-mono text-[#ededed] w-14 text-right shrink-0">
          {hasData ? `${pricePrefix}${formatNumber(q!.price, 2)}${priceSuffix}` : "—"}
        </span>
      </div>
    </div>
  );
}
