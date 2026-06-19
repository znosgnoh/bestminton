import Image from "next/image";

interface AvatarProps {
  name: string;
  avatarUrl: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_MAP = {
  sm: { px: 32, text: "text-xs" },
  md: { px: 48, text: "text-sm" },
  lg: { px: 64, text: "text-base" },
};

const BG_COLOURS = [
  "bg-emerald-500",
  "bg-blue-500",
  "bg-violet-500",
  "bg-orange-500",
  "bg-rose-500",
  "bg-teal-500",
  "bg-amber-500",
];

function nameToColour(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  }
  return BG_COLOURS[Math.abs(hash) % BG_COLOURS.length];
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .filter(Boolean)
    .slice(0, 2)
    .join("");
}

export default function Avatar({ name, avatarUrl, size = "md", className = "" }: AvatarProps) {
  const { px, text } = SIZE_MAP[size];

  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={name}
        width={px}
        height={px}
        className={`rounded-full object-cover ${className}`}
        style={{ width: px, height: px }}
      />
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-white ${nameToColour(name)} ${text} ${className}`}
      style={{ width: px, height: px }}
      aria-label={name}
    >
      {getInitials(name)}
    </div>
  );
}
