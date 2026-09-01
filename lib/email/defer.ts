import { waitUntil } from "@vercel/functions";

export function deferNotification(work: () => Promise<void>): void {
  const run = () =>
    work().catch((err) => {
      console.error("[email]", err);
    });
  try {
    waitUntil(run());
  } catch {
    void run();
  }
}
