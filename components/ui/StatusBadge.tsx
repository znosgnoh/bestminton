import type { ChallengeStatus } from "@/lib/types";

interface StatusBadgeProps {
  status: ChallengeStatus;
}

const STYLES: Record<ChallengeStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  ACTIVE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  COMPLETED: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

const LABELS: Record<ChallengeStatus, string> = {
  PENDING: "Chờ gạ",
  ACTIVE: "Đang đấu",
  COMPLETED: "Đã xong",
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  );
}
