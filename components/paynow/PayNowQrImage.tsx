"use client";

import { useMemo } from "react";
import { renderSVG } from "uqr";

interface PayNowQrImageProps {
  payload: string;
  size?: number;
  alt?: string;
  className?: string;
  /** When set, QR is tappable (e.g. open bank app sheet). */
  onActivate?: () => void;
  activateLabel?: string;
}

/** Render PayNow EMV payload as an SVG QR (pure JS, no canvas / native deps). */
export default function PayNowQrImage({
  payload,
  size = 240,
  alt = "PayNow QR",
  className,
  onActivate,
  activateLabel,
}: PayNowQrImageProps) {
  const svg = useMemo(() => {
    try {
      return renderSVG(payload, {
        ecc: "M",
        border: 2,
        pixelSize: 8,
        whiteColor: "#ffffff",
        blackColor: "#0f172a",
      });
    } catch {
      return null;
    }
  }, [payload]);

  if (!svg) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">Could not render QR.</p>
    );
  }

  const frameClass = `inline-block overflow-hidden rounded-lg bg-white [&>svg]:h-full [&>svg]:w-full ${className ?? ""}`;

  if (onActivate) {
    return (
      <button
        type="button"
        onClick={onActivate}
        className={`${frameClass} cursor-pointer ring-offset-2 transition hover:ring-2 hover:ring-emerald-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600`}
        style={{ width: size, height: size }}
        aria-label={activateLabel ?? alt}
      >
        <span
          className="block h-full w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </button>
    );
  }

  return (
    <div
      className={frameClass}
      style={{ width: size, height: size }}
      role="img"
      aria-label={alt}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
