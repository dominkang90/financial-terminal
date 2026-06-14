import type { DataStatus } from "@/types";

interface Props {
  status: DataStatus;
  className?: string;
}

const STATUS_CONFIG: Record<DataStatus, { label: string; color: string }> = {
  live:         { label: "최근가", color: "text-terminal-green" },
  delayed:      { label: "15분 지연", color: "text-terminal-yellow" },
  stale:        { label: "오래된 데이터", color: "text-terminal-gray" },
  no_data:      { label: "데이터 없음", color: "text-terminal-gray" },
  error:        { label: "오류", color: "text-terminal-red" },
  api_required: { label: "API 키 필요", color: "text-terminal-yellow" },
};

export function DataStatusBadge({ status, className = "" }: Props) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.error;
  return (
    <span className={`text-2xs font-mono ${cfg.color} ${className}`}>
      [{cfg.label}]
    </span>
  );
}

interface ChangeProps {
  value: number;
  suffix?: string;
  className?: string;
}

export function ChangeValue({ value, suffix = "", className = "" }: ChangeProps) {
  const isPos = value > 0;
  const isNeg = value < 0;
  const color = isPos ? "text-terminal-green" : isNeg ? "text-terminal-red" : "text-terminal-text-secondary";
  const sign = isPos ? "+" : "";
  return (
    <span className={`font-mono ${color} ${className}`}>
      {sign}{value.toFixed(2)}{suffix}
    </span>
  );
}

export function DataTrustNote({
  source,
  status,
  note,
  className = "",
}: {
  source?: string;
  status?: DataStatus;
  note?: string;
  className?: string;
}) {
  const sourceText = source || "제공처 확인 중";
  const statusText = status === "live"
    ? "제공처가 준 최신 가격입니다. 장이 닫힌 시간에는 마지막 체결가일 수 있어요."
    : status === "delayed"
      ? "보통 15분 정도 늦게 보일 수 있어요."
      : status === "stale"
        ? "오래된 값일 수 있어요."
        : status === "api_required"
          ? "API 키가 없어서 제한된 값만 보여줘요."
          : status === "no_data"
            ? "제공처에서 값을 받지 못했어요."
            : status === "error"
              ? "데이터를 가져오다 문제가 생겼어요."
              : "제공처 기준 값입니다.";

  return (
    <div className={`rounded border border-terminal-border bg-terminal-bg/70 px-2 py-1.5 text-[10px] font-mono text-terminal-text-dim leading-relaxed ${className}`}>
      <div>출처: {sourceText}</div>
      <div>상태: {statusText}</div>
      {note && <div>메모: {note}</div>}
      <div>안내: 투자 추천이 아니라 참고용 화면입니다.</div>
    </div>
  );
}

export function formatNumber(n: number | undefined | null, decimals = 2): string {
  if (n === null || n === undefined || isNaN(n)) return "—";
  if (Math.abs(n) >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
