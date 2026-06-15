import type { DataStatus } from "@/types";

interface Props {
  status: DataStatus;
  className?: string;
}

const STATUS_CONFIG: Record<DataStatus, { label: string; color: string }> = {
  live:         { label: "최근가", color: "text-terminal-green" },
  delayed:      { label: "지연 가능", color: "text-terminal-yellow" },
  stale:        { label: "확인 필요", color: "text-terminal-gray" },
  no_data:      { label: "아직 없음", color: "text-terminal-gray" },
  error:        { label: "불러오기 실패", color: "text-terminal-red" },
  api_required: { label: "연결 필요", color: "text-terminal-yellow" },
};

const STATUS_HELP: Record<DataStatus, string> = {
  live: "제공처가 준 최신 가격이에요. 장이 닫힌 시간에는 마지막 체결가일 수 있어요.",
  delayed: "실시간보다 조금 늦게 보일 수 있어요.",
  stale: "오래된 값일 수 있어 다시 확인이 필요해요.",
  no_data: "제공처에서 아직 값을 받지 못했어요.",
  error: "데이터를 가져오다 문제가 생겼어요.",
  api_required: "API 키나 연결 설정이 필요해요.",
};

export function getDataStatusLabel(status?: DataStatus): string {
  return status ? STATUS_CONFIG[status]?.label ?? "제공처 기준" : "제공처 기준";
}

export function getDataStatusHelp(status?: DataStatus): string {
  return status ? STATUS_HELP[status] ?? "제공처 기준 값이에요." : "제공처 기준 값이에요.";
}

export function DataStatusBadge({ status, className = "" }: Props) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.error;
  return (
    <span className={`inline-flex rounded border border-current/20 px-1.5 py-0.5 text-[10px] font-mono ${cfg.color} ${className}`} title={STATUS_HELP[status]}>
      {cfg.label}
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
  const statusText = getDataStatusHelp(status);

  return (
    <div className={`rounded border border-terminal-border bg-terminal-bg/70 px-2 py-1.5 text-[10px] font-mono text-terminal-text-dim leading-relaxed ${className}`}>
      <div>출처: {sourceText}</div>
      <div>상태: {statusText}</div>
      {note && <div>메모: {note}</div>}
      <div>안내: 투자 추천이 아니라 참고용 화면입니다.</div>
    </div>
  );
}

export function DataFreshnessLine({
  source,
  status,
  checkedAt,
  className = "",
}: {
  source?: string;
  status?: DataStatus;
  checkedAt?: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-mono text-terminal-text-dim ${className}`}>
      {status && <DataStatusBadge status={status} />}
      <span>출처: {source || "제공처 확인 중"}</span>
      {checkedAt && <span>확인: {checkedAt}</span>}
    </div>
  );
}

export function MissingValue({
  label = "확인 중",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return <span className={`font-mono text-terminal-text-dim ${className}`}>{label}</span>;
}

export function formatNumber(n: number | undefined | null, decimals = 2): string {
  if (n === null || n === undefined || isNaN(n)) return "—";
  if (Math.abs(n) >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
