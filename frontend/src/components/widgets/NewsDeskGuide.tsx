import { ExternalLink, Bell, FileText, Newspaper } from "lucide-react";

const sourceCards = [
  {
    title: "연합뉴스 경제",
    subtitle: "속보",
    url: "https://www.yna.co.kr/economy/index",
    description: "아침 헤드라인과 장 시작 전 전체 분위기 체크용",
  },
  {
    title: "한국경제 증권",
    subtitle: "국내 증시 뉴스",
    url: "https://www.hankyung.com/finance",
    description: "장중 속보와 종목/수급 기사 확인용",
  },
  {
    title: "이데일리 증권",
    subtitle: "개별 종목 뉴스",
    url: "https://www.edaily.co.kr/articles/stock",
    description: "단타·스윙 투자자가 빠르게 보는 속보/재료 기사",
  },
  {
    title: "다음 증권 뉴스",
    subtitle: "종합 뉴스",
    url: "https://finance.daum.net/news",
    description: "여러 매체를 한 번에 모아보는 종합 뷰",
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

export function NewsDeskGuide({
  investorStyle,
  onInvestorStyleChange,
}: {
  investorStyle: keyof typeof investorStyles;
  onInvestorStyleChange: (style: keyof typeof investorStyles) => void;
}) {
  const selectedStyle = investorStyles[investorStyle];

  return (
    <div className="space-y-3 mb-4">
      <div className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] p-3">
        <div className="flex items-center gap-2 mb-2">
          <Newspaper size={14} className="text-[#ff6600]" />
          <h3 className="text-xs font-semibold text-[#f5f5f5]">실전 뉴스 데스크</h3>
          <span className="text-2xs font-mono text-[#555]">뉴스 + 공시 + 리포트 조합</span>
        </div>
        <p className="text-2xs text-[#777] leading-relaxed">
          수익 내는 투자자는 뉴스만 보지 않고 공시와 리포트를 같이 봅니다. 아래 바로가기와 루틴을 같이 쓰면 장중 판단 속도가 훨씬 빨라집니다.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-3">
        <div className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] p-3">
          <div className="flex items-center gap-2 mb-3">
            <ExternalLink size={14} className="text-[#3399ff]" />
            <h3 className="text-xs font-semibold text-[#f5f5f5]">추천 정보 소스</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {sourceCards.map((card) => (
              <a
                key={card.title}
                href={card.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-[#1f1f1f] bg-[#111] p-3 hover:border-[#333] hover:bg-[#151515] transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-2xs font-mono text-[#ff6600]">{card.subtitle}</div>
                    <div className="text-xs text-[#f2f2f2] mt-0.5">{card.title}</div>
                  </div>
                  <ExternalLink size={12} className="text-[#555] flex-shrink-0" />
                </div>
                <p className="mt-2 text-2xs text-[#777] leading-relaxed">{card.description}</p>
              </a>
            ))}
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
