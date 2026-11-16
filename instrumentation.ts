export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { ensurePaynowMobileColumn } = await import("@/lib/ensurePaynowMobile");
    await ensurePaynowMobileColumn();
  } catch (err) {
    console.warn("[instrumentation] ensurePaynowMobileColumn:", err);
  }
}
