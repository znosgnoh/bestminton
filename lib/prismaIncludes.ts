/** Full match include — detail views, settlement, registration. */
export const MATCH_FULL_INCLUDE = {
  registrations: {
    include: { member: true, guests: true },
    orderBy: { joinedAt: "asc" as const },
  },
} as const;

/** Lightweight include — list cards only need headcount. */
export const MATCH_LIST_INCLUDE = {
  registrations: {
    select: {
      id: true,
      matchId: true,
      memberId: true,
      joinedAt: true,
      playedFull: true,
      guests: { select: { id: true, label: true, playedFull: true } },
      member: { select: { id: true, name: true, avatarUrl: true, splitwiseId: true } },
    },
    orderBy: { joinedAt: "asc" as const },
  },
} as const;
