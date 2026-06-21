interface ShuttlecockIconProps {
  size?: number;
  className?: string;
}

/** Badminton shuttlecock — Lucide-style stroke icon (no Lucide equivalent). */
export default function ShuttlecockIcon({ size = 24, className = "" }: ShuttlecockIconProps) {
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
      <path d="M12 3v11" />
      <path d="M12 3c-2.5 2.5-4 5.5-4.5 9" />
      <path d="M12 3c2.5 2.5 4 5.5 4.5 9" />
      <path d="M8 12c1.5 1 2.5 2.5 3 4.5" />
      <path d="M16 12c-1.5 1-2.5 2.5-3 4.5" />
      <ellipse cx="12" cy="18.5" rx="3.5" ry="2" fill="currentColor" stroke="none" />
    </svg>
  );
}
