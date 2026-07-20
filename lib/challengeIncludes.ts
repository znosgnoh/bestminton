const CHALLENGE_PLAYER_SELECT = {
  id: true,
  name: true,
  avatarUrl: true,
  eloRating: true,
  totalMatches: true,
  totalWins: true,
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

/**
 * List/history views — players + bet amounts for pool counts only.
 * Avoids loading bettor/counterparty rows for every kèo on list pages.
 */
export const CHALLENGE_LIST_INCLUDE = {
  playerA: { select: CHALLENGE_PLAYER_SELECT },
  playerA2: { select: CHALLENGE_PLAYER_SELECT },
  playerB: { select: CHALLENGE_PLAYER_SELECT },
  playerB2: { select: CHALLENGE_PLAYER_SELECT },
  bets: {
    select: {
      side: true,
      amount: true,
    },
  },
} as const;
