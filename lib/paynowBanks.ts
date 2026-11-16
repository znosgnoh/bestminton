/**
 * Singapore bank / wallet app openers.
 *
 * There is no public PayNow URL that prefills recipient + amount in every bank
 * app (ABS has not published a deep-link spec; banks reject free-form prefills
 * to prevent phishing). Opening the app + clipboard handoff is the practical
 * same-phone flow; SGQR scan remains the cross-device / prefilled-amount path.
 */

export interface PaynowBankApp {
  id: string;
  name: string;
  /** Custom URL scheme that typically opens the installed app */
  scheme: string;
}

export const PAYNOW_BANK_APPS: PaynowBankApp[] = [
  { id: "dbs", name: "DBS digibank", scheme: "dbsmbanking://" },
  { id: "paylah", name: "DBS PayLah!", scheme: "dbspaylah://com.dbs.paylah/" },
  { id: "ocbc", name: "OCBC Digital", scheme: "ocbcdigital://" },
  { id: "uob", name: "UOB TMRW", scheme: "uobtmrw://" },
  { id: "sc", name: "SC Mobile", scheme: "scmobile://" },
  { id: "maybank", name: "Maybank2u", scheme: "maybank2u://" },
  { id: "trust", name: "Trust", scheme: "trust://" },
  { id: "gxs", name: "GXS", scheme: "gxsbank://" },
  { id: "mari", name: "MariBank", scheme: "maribank://" },
];

/** Clipboard text for a PayNow transfer (mobile number, easy to paste). */
export function paynowClipboardText(mobile: string): string {
  return mobile.replace(/^\+65/, "");
}

/**
 * Try to open a bank app via its custom scheme.
 * Returns false if the navigation likely stayed in the browser (best-effort).
 */
export function openBankApp(scheme: string): void {
  // Hidden iframe first — quieter on some Android WebViews — then location.
  try {
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = scheme;
    document.body.appendChild(iframe);
    window.setTimeout(() => {
      iframe.remove();
    }, 1500);
  } catch {
    // ignore
  }
  window.location.href = scheme;
}

export async function copyAndOpenBankApp(
  mobile: string,
  scheme: string
): Promise<void> {
  try {
    await navigator.clipboard.writeText(paynowClipboardText(mobile));
  } catch {
    // clipboard may be blocked — still try opening the app
  }
  openBankApp(scheme);
}
