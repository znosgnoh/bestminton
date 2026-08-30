import { revalidatePath } from "next/cache";

export function revalidateMatchPages(matchId?: number) {
  revalidatePath("/");
  revalidatePath("/management");
  revalidatePath("/balances");
  if (matchId) revalidatePath(`/matches/${matchId}`);
}

export function revalidateMemberPages(memberId?: number) {
  revalidatePath("/");
  revalidatePath("/management");
  revalidatePath("/leaderboard");
  revalidatePath("/challenges");
  revalidatePath("/cam");
  if (memberId) revalidatePath(`/members/${memberId}`);
}

export function revalidateChallengePages(challengeId?: number) {
  revalidatePath("/challenges");
  revalidatePath("/leaderboard");
  revalidatePath("/management");
  if (challengeId) revalidatePath(`/challenges/${challengeId}`);
  // Profiles show challenge + Elo history
  revalidatePath("/members", "layout");
}

export function revalidateDebtPages() {
  revalidatePath("/");
  revalidatePath("/management");
  revalidatePath("/leaderboard");
  revalidatePath("/cam");
}
