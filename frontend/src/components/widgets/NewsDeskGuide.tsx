import { ExternalLink, Bell, FileText, Newspaper, Images } from "lucide-react";
import type { NewsArticle } from "@/types";

type SourceCard = {
  title: string;
  subtitle: string;
  url: string;
  description: string;
  liveSource?: string;
};

const sourceCards: SourceCard[] = [
  {
    title: "연합뉴스 경제",
    subtitle: "속보",
    url: "https://www.yna.co.kr/economy/index",
    description: "아침 헤드라인과 장 시작 전 전체 분위기 체크용",
    liveSource: "연합뉴스 경제",
  },
  {
    title: "한국경제 증권",
    subtitle: "국내 증시 뉴스",
    url: "https://www.hankyung.com/finance",
    description: "장중 속보와 종목/수급 기사 확인용",
    liveSource: "한국경제 증권",
  },
  {
    title: "매일경제 증권",
    subtitle: "개별 종목 뉴스",
    url: "https://www.mk.co.kr/news/stock/",
    description: "개별 종목 재료와 업종 기사 같이 보기 좋음",
    liveSource: "매일경제 증권",
  },
  {
    title: "ChosunBiz 증권",
    subtitle: "종합 뉴스",
    url: "https://biz.chosun.com/stock/",
    description: "시장 전체 흐름과 기업 기사 같이 보기 좋음",
    liveSource: "ChosunBiz 증권",
  },
  {
    title: "DART 전자공시",
    subtitle: "공시 확인",
    url: "https://dart.fss.or.kr",
    description: "뉴스보다 먼저 확인해야 하는 원본 공시 데이터",
  },
  {
    title: "한경 컨센서스",
    subtitle: "리포트",
    url: "https://consensus.hankyung.com",
    description: "중장기 투자용 증권사 리포트와 목표가 체크",
  },
];

const investorStyles = {
  beginner: {
    label: "입문자",
    points: ["네이버 증권 + 한국경제 + 이데일리 중심", "하루 10분만: 헤드라인 → 관심종목 뉴스 → 마감 정리"],
  },
  shortterm: {
    label: "단타·스윙",
    points: ["이데일리 + 매일경제 + 연합뉴스 + DART", "공시 → 뉴스 → 수급 순서로 빠르게 확인"],
  },
  longterm: {
    label: "중장기",
    points: ["증권사 리포트 + 기업 IR + DART 중심", "뉴스보다 리포트와 공시 비중을 높여 판단"],
  },
} as const;

const routines = [
  { time: "아침 8시", title: "헤드라인 + 미국장 체크", description: "연합뉴스 경제, 미국 증시 흐름, 환율/금리 먼저 확인" },
  { time: "오전 9시", title: "관심종목 공시 확인", description: "DART 공시와 장초 수급을 함께 확인" },
  { time: "장중", title: "속보 모니터링", description: "이데일리 속보와 한국경제 속보를 중심으로 재료 체크" },
  { time: "저녁", title: "리포트 3개 읽기", description: "한경 컨센서스와 증권사 리포트로 다음날 전략 정리" },
];

function SourcePreview({ article, title }: { article?: NewsArticle; title: string }) {
  if (article?.image) {
    return (
      <div className="w-full h-24 rounded-lg overflow-hidden bg-[#0a0a0a] border border-[#1f1f1f]">
        <img src={article.image} alt={title} className="w-full h-full object-cover" loading="lazy" />
      </div>
    );
  }

  return (
    <div className="w-full h-24 rounded-lg border border-dashed border-[#2b2b2b] bg-[#101010] flex items-center justify-center gap-2 text-[#555]">
      <Images size={14} />
      <span className="text-2xs font-mono">썸네일 준비중</span>
    </div>
  );
}

export function NewsDeskGuide({
  investorStyle,
  onInvestorStyleChange,
  previewArticles,
  selectedSource,
  onSelectSource,
  sourceCounts,
}: {
  investorStyle: keyof typeof investorStyles;
  onInvestorStyleChange: (style: keyof typeof investorStyles) => void;
  previewArticles: NewsArticle[];
  selectedSource: string;
  onSelectSource: (source: string) => void;
  sourceCounts: Record<string, number>;
}) {
  const selectedStyle = investorStyles[investorStyle];
  const previewMap = new Map(previewArticles.map((article) => [article.source, article]));

  return (
    <div className="space-y-3 mb-4">
      <div className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] p-3">
        <div className="flex items-center gap-2 mb-2">
          <Newspaper size={14} className="text-[#ff6600]" />
          <h3 className="text-xs font-semibold text-[#f5f5f5]">실전 뉴스 데스크</h3>
          <span className="text-2xs font-mono text-[#555]">뉴스 + 공시 + 리포트 조합</span>
        </div>
        <p className="text-2xs text-[#777] leading-relaxed">
          아래 카드에서 바로 기사 소스를 고르면, 그 매체 기사만 아래 목록에 모아서 볼 수 있어요. 공시와 리포트 카드는 원문 사이트로 바로 이동합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-3">
        <div className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] p-3">
          <div className="flex items-center gap-2 mb-3">
            <ExternalLink size={14} className="text-[#3399ff]" />
            <h3 className="text-xs font-semibold text-[#f5f5f5]">추천 정보 소스</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {sourceCards.map((card) => {
              const preview = card.liveSource ? previewMap.get(card.liveSource) : undefined;
              const isSelected = selectedSource !== "all" && selectedSource === card.liveSource;
              const isFilterCard = Boolean(card.liveSource);
              const liveCount = card.liveSource ? (sourceCounts[card.liveSource] ?? 0) : null;

              return (
                <button
                  key={card.title}
                  type="button"
                  onClick={() => {
                    if (card.liveSource) {
                      onSelectSource(isSelected ? "all" : card.liveSource);
                    } else {
                      window.open(card.url, "_blank", "noopener,noreferrer");
                    }
                  }}
                  className={`text-left rounded-lg border p-3 transition-colors ${
                    isSelected
                      ? "border-[#ff6600]/50 bg-[#17120d]"
                      : "border-[#1f1f1f] bg-[#111] hover:border-[#333] hover:bg-[#151515]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap text-2xs font-mono text-[#ff6600]">
                        <span>{card.subtitle}</span>
                        {liveCount !== null && (
                          <span className="rounded bg-[#1a1a1a] px-1 py-0.5 text-[#cfcfcf]">{liveCount}건</span>
                        )}
                        {isSelected && <span className="rounded bg-[#ff6600]/15 px-1 py-0.5 text-[#ffb066]">선택중</span>}
                      </div>
                      <div className="text-xs text-[#f2f2f2] mt-0.5">{card.title}</div>
                    </div>
                    <a
                      href={card.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(event) => event.stopPropagation()}
                      className="text-[#555] hover:text-[#999] flex-shrink-0"
                    >
                      <ExternalLink size={12} />
                    </a>
                  </div>

                  <div className="mt-2">
                    <SourcePreview article={preview} title={card.title} />
                  </div>

                  <p className="mt-2 text-2xs text-[#777] leading-relaxed">{card.description}</p>
                  {isFilterCard && (
                    <div className="mt-2 text-2xs font-mono text-[#666]">
                      {preview
                        ? `앱 안에서 실시간 기사 ${liveCount ?? 0}건 보기 가능`
                        : "기사 수집 중"}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] p-3 space-y-3">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Bell size={14} className="text-[#ffd166]" />
              <h3 className="text-xs font-semibold text-[#f5f5f5]">투자자 스타일별 추천</h3>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {(Object.entries(investorStyles) as [keyof typeof investorStyles, typeof selectedStyle][]).map(([key, style]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onInvestorStyleChange(key)}
                  className={`px-2 py-1 rounded text-2xs font-mono border ${
                    investorStyle === key
                      ? "bg-[#ff6600] text-black border-[#ff6600]"
                      : "border-[#262626] text-[#666] hover:text-[#999]"
                  }`}
                >
                  {style.label}
                </button>
              ))}
            </div>
            <div className="space-y-2 rounded-lg border border-[#1f1f1f] bg-[#111] p-3">
              {selectedStyle.points.map((point) => (
                <div key={point} className="text-2xs text-[#c8c8c8] leading-relaxed">• {point}</div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <FileText size={14} className="text-[#7bd389]" />
              <h3 className="text-xs font-semibold text-[#f5f5f5]">오늘의 추천 루틴</h3>
            </div>
            <div className="space-y-2">
              {routines.map((routine) => (
                <div key={routine.time} className="rounded-lg border border-[#1f1f1f] bg-[#111] p-2.5">
                  <div className="text-2xs font-mono text-[#ff6600]">{routine.time}</div>
                  <div className="text-xs text-[#f2f2f2] mt-1">{routine.title}</div>
                  <div className="text-2xs text-[#777] mt-1 leading-relaxed">{routine.description}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
