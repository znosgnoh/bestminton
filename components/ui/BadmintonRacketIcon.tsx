interface BadmintonRacketIconProps {
  size?: number;
  className?: string;
  /** Filled brand mark (header logo). Default is stroke icon. */
  variant?: "stroke" | "logo";
}

/** Badminton racket — Lucide-style stroke, or filled brand logo. */
export default function BadmintonRacketIcon({
  size = 24,
  className = "",
  variant = "stroke",
}: BadmintonRacketIconProps) {
  if (variant === "logo") {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        className={className}
        aria-hidden
      >
        {/* Head oval */}
        <ellipse cx="12" cy="7.2" rx="6.2" ry="5.2" fill="currentColor" opacity="0.95" />
        {/* Inner head cutout for string bed */}
        <ellipse cx="12" cy="7.2" rx="4.2" ry="3.4" fill="currentColor" className="text-slate-950" opacity="0.35" />
        {/* Strings */}
        <path
          d="M8.6 7.2h6.8M12 4.2v6M9.8 5.4h4.4M9.8 9h4.4"
          stroke="currentColor"
          strokeWidth="1.1"
          strokeLinecap="round"
          opacity="0.9"
        />
        {/* Throat / handle join */}
        <rect x="10.7" y="11.4" width="2.6" height="2.2" rx="0.6" fill="currentColor" />
        {/* Shaft */}
        <path
          d="M12 13.4v7.2"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        {/* Grip tip */}
        <path
          d="M10.4 21.2h3.2"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }

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
