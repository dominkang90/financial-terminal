import type { DataStatus } from "@/types";

interface Props {
  status: DataStatus;
  className?: string;
}

const STATUS_CONFIG: Record<DataStatus, { label: string; color: string }> = {
  live:         { label: "실시간", color: "text-terminal-green" },
  delayed:      { label: "지연 15분", color: "text-terminal-yellow" },
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

export function formatNumber(n: number | undefined | null, decimals = 2): string {
  if (n === null || n === undefined || isNaN(n)) return "—";
  if (Math.abs(n) >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
