import { renderSVG } from "uqr";

function sanitizeFilenamePart(value: string): string {
  return value
    .trim()
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export function paynowQrFilename(opts: {
  name: string;
  amount?: number | null;
}): string {
  const name = sanitizeFilenamePart(opts.name) || "paynow";
  const amount =
    opts.amount != null && Number.isFinite(opts.amount) && opts.amount > 0
      ? opts.amount.toFixed(2).replace(".", "-")
      : null;
  return amount ? `paynow-${name}-${amount}.png` : `paynow-${name}.png`;
}

function svgToPngBlob(svg: string, pixelSize = 1024): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = pixelSize;
        canvas.height = pixelSize;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas unavailable."));
          return;
        }
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, pixelSize, pixelSize);
        ctx.drawImage(img, 0, 0, pixelSize, pixelSize);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("PNG encode failed."));
              return;
            }
            resolve(blob);
          },
          "image/png",
          1
        );
      } catch (err) {
        reject(err);
      } finally {
        URL.revokeObjectURL(url);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not render QR image."));
    };

    img.src = url;
  });
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export type SavePayNowQrResult = "shared" | "downloaded";

/** Save PayNow QR as PNG — prefers native share sheet (Save Image) when available. */
export async function savePayNowQr(
  payload: string,
  filename: string
): Promise<SavePayNowQrResult> {
  const svg = renderSVG(payload, {
    ecc: "M",
    border: 2,
    pixelSize: 10,
    whiteColor: "#ffffff",
    blackColor: "#0f172a",
  });
  const blob = await svgToPngBlob(svg, 1024);
  const file = new File([blob], filename, { type: "image/png" });

  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
  };

  if (typeof nav.share === "function" && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({
        files: [file],
        title: "PayNow QR",
      });
      return "shared";
    } catch (err) {
      // User cancelled share — don't fall through to a surprise download.
      if (err instanceof DOMException && err.name === "AbortError") {
        throw err;
      }
      // Share unsupported for this file — download instead.
    }
  }

  triggerDownload(blob, filename);
  return "downloaded";
}
