export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { ensurePaynowMobileColumn } = await import("@/lib/ensurePaynowMobile");
    await ensurePaynowMobileColumn();
  } catch (err) {
    console.warn("[instrumentation] ensurePaynowMobileColumn:", err);
  }
  try {
    const { ensureMaxPlayersColumn } = await import("@/lib/ensureMaxPlayers");
    await ensureMaxPlayersColumn();
  } catch (err) {
    console.warn("[instrumentation] ensureMaxPlayersColumn:", err);
  }
}
