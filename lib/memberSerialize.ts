import { debtSummaryFor, getAllDebtSummaries } from "./ojBalance";
import type { MemberDebtSummary, MemberDTO } from "./types";

const EMPTY_DEBT_SUMMARY: MemberDebtSummary = {
  totalOwed: 0,
  totalOwing: 0,
  netCam: 0,
};

type MemberRow = {
  id: number;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  splitwiseId: number | null;
  eloRating: number;
  totalMatches: number;
  totalWins: number;
  singlesWinStreak: number;
  singlesLoseStreak: number;
  emailNotificationsEnabled: boolean;
};

export function toMemberDTO(
  member: MemberRow,
  debtSummary: MemberDebtSummary = EMPTY_DEBT_SUMMARY
): MemberDTO {
  return { ...member, debtSummary };
}

export async function membersToDTOs(members: MemberRow[]): Promise<MemberDTO[]> {
  const summaries = await getAllDebtSummaries();
  return members.map((m) => toMemberDTO(m, debtSummaryFor(m.id, summaries)));
}

export async function memberToDTO(member: MemberRow): Promise<MemberDTO> {
  const summaries = await getAllDebtSummaries();
  return toMemberDTO(member, debtSummaryFor(member.id, summaries));
}
