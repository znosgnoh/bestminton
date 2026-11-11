import type { MemberDTO } from "./types";

/** Treat missing isActive as true for older IndexedDB / cached payloads. */
export function isMemberActive(member: Pick<MemberDTO, "isActive">): boolean {
  return member.isActive !== false;
}

/**
 * Members shown on the match registration roster:
 * active members, plus any inactive member already registered (so they can unregister).
 */
export function membersForRegistrationRoster<T extends Pick<MemberDTO, "id" | "isActive">>(
  members: T[],
  registeredMemberIds: Iterable<number>
): T[] {
  const registered = new Set(registeredMemberIds);
  return members.filter((m) => isMemberActive(m) || registered.has(m.id));
}
