"use client";

import { useMemo } from "react";
import { renderSVG } from "uqr";

interface PayNowQrImageProps {
  payload: string;
  size?: number;
  alt?: string;
  className?: string;
}

/** Render PayNow EMV payload as an SVG QR (pure JS, no canvas / native deps). */
export default function PayNowQrImage({
  payload,
  size = 240,
  alt = "PayNow QR",
  className,
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

  return (
    <div
      className={`inline-block overflow-hidden rounded-lg bg-white [&>svg]:h-full [&>svg]:w-full ${className ?? ""}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={alt}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
