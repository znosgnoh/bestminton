import { db } from "@/lib/db";
import type { EmailRecipient } from "./types";

export const ELIGIBLE_MEMBER_SELECT = {
  id: true,
  name: true,
  email: true,
  emailNotificationsEnabled: true,
  isActive: true,
} as const;

type EligibleRow = {
  id: number;
  name: string;
  email: string | null;
  emailNotificationsEnabled: boolean;
  isActive?: boolean;
};

export function filterEligibleRecipients(rows: EligibleRow[]): EmailRecipient[] {
  return rows
    .filter((m) => m.isActive !== false && m.email && m.emailNotificationsEnabled)
    .map((m) => ({ memberId: m.id, email: m.email!, name: m.name }));
}

export async function unregisteredMembersForMatch(matchId: number): Promise<EmailRecipient[]> {
  const registered = await db.matchRegistration.findMany({
    where: { matchId },
    select: { memberId: true },
  });
  const registeredIds = new Set(registered.map((r) => r.memberId));
  const members = await db.member.findMany({
    where: { isActive: true },
    select: ELIGIBLE_MEMBER_SELECT,
  });
  return filterEligibleRecipients(members).filter((m) => !registeredIds.has(m.memberId));
}

export async function eligibleMembersByIds(memberIds: number[]): Promise<EmailRecipient[]> {
  if (memberIds.length === 0) return [];
  const uniqueIds = [...new Set(memberIds)];
  const members = await db.member.findMany({
    where: { id: { in: uniqueIds }, isActive: true },
    select: ELIGIBLE_MEMBER_SELECT,
  });
  return filterEligibleRecipients(members);
}

/** All active members with an email and notifications enabled. */
export async function allEligibleMembers(): Promise<EmailRecipient[]> {
  const members = await db.member.findMany({
    where: { isActive: true },
    select: ELIGIBLE_MEMBER_SELECT,
  });
  return filterEligibleRecipients(members);
}
