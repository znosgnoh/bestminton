import { revalidatePath } from "next/cache";

export function revalidateMatchPages(matchId?: number) {
  revalidatePath("/");
  revalidatePath("/management");
  if (matchId) revalidatePath(`/matches/${matchId}`);
}

export function revalidateMemberPages() {
  revalidatePath("/");
  revalidatePath("/management");
}
