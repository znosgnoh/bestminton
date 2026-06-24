import OrangeJuiceIcon from "@/components/ui/OrangeJuiceIcon";
import { DRINK_CHALLENGE_LABEL } from "@/lib/constants";

interface DrinkChallengeBadgeProps {
  className?: string;
}

export default function DrinkChallengeBadge({ className = "" }: DrinkChallengeBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-700 dark:bg-orange-950/50 dark:text-orange-300 ${className}`}
    >
      <OrangeJuiceIcon size={10} className="text-orange-600 dark:text-orange-400" />
      {DRINK_CHALLENGE_LABEL}
    </span>
  );
}
