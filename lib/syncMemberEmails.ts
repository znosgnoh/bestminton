import { db } from "./db";
import { normalizeMemberEmail } from "./memberEmail";
import { revalidateMemberPages } from "./revalidate";
import { fetchSplitwiseGroupMembers } from "./splitwiseGroupMembers";
import type { SyncMemberEmailsResponse } from "./types";

type MemberRow = { id: number; splitwiseId: number | null; email: string | null };

/** Pure planner — exported for tests. */
export function planMemberEmailUpdates(
  members: ReadonlyArray<MemberRow>,
  splitwiseEmails: ReadonlyMap<number, string>
): Array<{ id: number; email: string }> {
  const updates: Array<{ id: number; email: string }> = [];
  for (const member of members) {
    if (member.splitwiseId == null) continue;
    const next = splitwiseEmails.get(member.splitwiseId);
    if (!next || member.email === next) continue;
    updates.push({ id: member.id, email: next });
  }
  return updates;
}

export async function syncMemberEmailsFromSplitwise(): Promise<SyncMemberEmailsResponse> {
  const splitwiseMembers = await fetchSplitwiseGroupMembers();

  const emailBySplitwiseId = new Map<number, string>();
  for (const sw of splitwiseMembers) {
    const email = normalizeMemberEmail(sw.email);
    if (email) emailBySplitwiseId.set(sw.id, email);
  }

  const members = await db.member.findMany({
    select: { id: true, splitwiseId: true, email: true },
  });
  const linkedSplitwiseIds = new Set(
    members.map((m) => m.splitwiseId).filter((id): id is number => id != null)
  );

  const skippedUnmapped: SyncMemberEmailsResponse["skippedUnmapped"] = [];
  for (const sw of splitwiseMembers) {
    const email = normalizeMemberEmail(sw.email);
    if (!email || linkedSplitwiseIds.has(sw.id)) continue;
    skippedUnmapped.push({
      splitwiseId: sw.id,
      name: sw.displayName ?? sw.first_name,
      email,
    });
  }

  const skippedNoEmail = members.filter(
    (m) => m.splitwiseId != null && !emailBySplitwiseId.has(m.splitwiseId)
  ).length;

  const updates = planMemberEmailUpdates(members, emailBySplitwiseId);
  const unchanged = members.filter(
    (m) =>
      m.splitwiseId != null &&
      emailBySplitwiseId.has(m.splitwiseId) &&
      m.email === emailBySplitwiseId.get(m.splitwiseId)
  ).length;

  if (updates.length > 0) {
    await db.$transaction(
      updates.map((u) =>
        db.member.update({ where: { id: u.id }, data: { email: u.email } })
      )
    );
    revalidateMemberPages();
  }

  return {
    updated: updates.length,
    unchanged,
    skippedNoEmail,
    skippedUnmapped,
  };
}
