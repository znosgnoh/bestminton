interface BadmintonRacketIconProps {
  size?: number;
  className?: string;
}

/** Badminton racket — Lucide-style stroke icon (no Lucide equivalent). */
export default function BadmintonRacketIcon({ size = 24, className = "" }: BadmintonRacketIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <ellipse cx="12" cy="7.5" rx="5.5" ry="4.5" />
      <path d="M8.5 7.5h7" />
      <path d="M12 3.5v8" />
      <path d="M10 5.5h4" />
      <path d="M10 9.5h4" />
      <path d="M12 12v9" />
    </svg>
  );
}
