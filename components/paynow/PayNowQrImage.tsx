"use client";

import { useEffect, useState } from "react";

interface PayNowQrImageProps {
  payload: string;
  size?: number;
  alt?: string;
  className?: string;
}

export default function PayNowQrImage({
  payload,
  size = 240,
  alt = "PayNow QR",
  className,
}: PayNowQrImageProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    setDataUrl(null);

    // Dynamic import keeps `qrcode` out of the SSR graph.
    void import("qrcode")
      .then((QRCode) =>
        QRCode.toDataURL(payload, {
          width: size,
          margin: 2,
          errorCorrectionLevel: "M",
          color: { dark: "#0f172a", light: "#ffffff" },
        })
      )
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [payload, size]);

  if (error) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">Could not render QR.</p>
    );
  }

  if (!dataUrl) {
    return (
      <div
        className={`animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800 ${className ?? ""}`}
        style={{ width: size, height: size }}
        aria-hidden
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- data URL from qrcode
    <img
      src={dataUrl}
      width={size}
      height={size}
      alt={alt}
      className={`rounded-lg bg-white ${className ?? ""}`}
    />
  );
}
