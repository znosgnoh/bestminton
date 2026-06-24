interface OrangeJuiceIconProps {
  size?: number;
  className?: string;
}

/** Orange juice glass — Lucide-style stroke icon (no Lucide equivalent in v1). */
export default function OrangeJuiceIcon({ size = 24, className = "" }: OrangeJuiceIconProps) {
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
      <path d="M8 3h8l-1 18H9L8 3z" />
      <path d="M8 7h8" />
      <path
        d="M9.5 10h5v8.5a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1V10z"
        fill="currentColor"
        fillOpacity="0.25"
        stroke="none"
      />
      <circle cx="17" cy="6" r="2.5" fill="currentColor" fillOpacity="0.35" stroke="currentColor" />
    </svg>
  );
}
