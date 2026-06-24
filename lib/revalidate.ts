import { revalidatePath } from "next/cache";

export function revalidateMatchPages(matchId?: number) {
  revalidatePath("/");
  revalidatePath("/management");
  if (matchId) revalidatePath(`/matches/${matchId}`);
}

export function revalidateMemberPages() {
  revalidatePath("/");
  revalidatePath("/management");
  revalidatePath("/leaderboard");
  revalidatePath("/challenges");
  revalidatePath("/cam");
}

export function revalidateChallengePages(challengeId?: number) {
  revalidatePath("/challenges");
  revalidatePath("/leaderboard");
  revalidatePath("/management");
  if (challengeId) revalidatePath(`/challenges/${challengeId}`);
}

export function revalidateDebtPages() {
  revalidatePath("/");
  revalidatePath("/management");
  revalidatePath("/leaderboard");
  revalidatePath("/cam");
}
