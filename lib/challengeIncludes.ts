const CHALLENGE_PLAYER_SELECT = {
  id: true,
  name: true,
  avatarUrl: true,
  eloRating: true,
} as const;

const BET_MEMBER_SELECT = {
  id: true,
  name: true,
  avatarUrl: true,
} as const;

/** Full challenge include — detail, settlement, betting. */
export const CHALLENGE_FULL_INCLUDE = {
  playerA: { select: CHALLENGE_PLAYER_SELECT },
  playerA2: { select: CHALLENGE_PLAYER_SELECT },
  playerB: { select: CHALLENGE_PLAYER_SELECT },
  playerB2: { select: CHALLENGE_PLAYER_SELECT },
  bets: {
    include: {
      bettor: { select: BET_MEMBER_SELECT },
      counterparty: { select: BET_MEMBER_SELECT },
    },
    orderBy: { createdAt: "asc" as const },
  },
} as const;

/** List view — same shape, bets used only for pool counts. */
export const CHALLENGE_LIST_INCLUDE = CHALLENGE_FULL_INCLUDE;
