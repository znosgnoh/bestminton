// --- Splitwise API shapes ---

export interface SplitwiseMember {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  picture: { small: string; medium: string; large: string };
  displayName?: string;
}

// --- Legacy SPA domain models (kept for backward compat with existing hooks/components) ---

export interface AttendanceRecord {
  memberId: number;
  firstName: string;
  lastName: string;
  present: boolean;
  hours: number;
  guests: number;
  isManual: boolean;
}

// --- Step-based UI state machine (legacy SPA) ---

export type AppStep = "init" | "attendance" | "review";
export type SyncStatus = "idle" | "syncing" | "success" | "error";

export interface SessionState {
  step: AppStep;
  totalCost: number | "";
  paidById: number | null;
  members: SplitwiseMember[];
  attendance: AttendanceRecord[];
  membersLoading: boolean;
  membersError: string | null;
  syncStatus: SyncStatus;
  syncError: string | null;
}

// --- Database DTO shapes (returned by API routes) ---

export interface MemberDebtSummary {
  totalOwed: number;
  totalOwing: number;
  netCam: number;
}

export interface MemberDTO {
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
  debtSummary: MemberDebtSummary;
}

export interface UpdateMemberEmailPreferencesRequest {
  emailNotificationsEnabled: boolean;
  pin?: string;
}

export interface MarkLedgerPaidResult {
  snapshot: LedgerSnapshotDTO;
  appliedShareIds: number[];
  appliedCents: number;
}

export interface SyncMemberEmailsResponse {
  updated: number;
  unchanged: number;
  skippedNoEmail: number;
  skippedUnmapped: Array<{ splitwiseId: number; name: string; email: string }>;
}

export interface LeaderboardEntryDTO extends MemberDTO {
  rank: number;
  winRate: number;
}

export type ChallengeFormat = "SINGLES" | "DOUBLES";
export type ChallengeStatus = "PENDING" | "ACTIVE" | "COMPLETED";
export type ChallengeSide = "A" | "B";

export interface ChallengePlayerDTO {
  id: number;
  name: string;
  avatarUrl: string | null;
  eloRating: number;
  totalMatches: number;
  totalWins: number;
  winRate: number;
}

export interface ChallengeSideDTO {
  players: ChallengePlayerDTO[];
  averageElo: number;
  winProbability: number;
  poolTokens: number;
  poolBets: number;
}

export interface BetDTO {
  id: number;
  challengeId: number;
  bettorId: number;
  counterpartyId: number | null;
  side: ChallengeSide;
  amount: number;
  bettor: Pick<MemberDTO, "id" | "name" | "avatarUrl">;
  counterparty: Pick<MemberDTO, "id" | "name" | "avatarUrl"> | null;
}

export interface ChallengeDebtRecord {
  debtorId: number;
  debtorName: string;
  creditorId: number;
  creditorName: string;
  amount: number;
  reason: "match" | "bet";
}

export interface ChallengeStreakChange {
  memberId: number;
  beforeWinStreak: number;
  beforeLoseStreak: number;
  afterWinStreak: number;
  afterLoseStreak: number;
}

export interface ChallengeResolutionDTO {
  eloChanges: Array<{
    memberId: number;
    name: string;
    before: number;
    after: number;
    delta: number;
  }>;
  debts: ChallengeDebtRecord[];
  /** Pre/post singles streaks for un-resolve / re-resolve. Absent on older kèo. */
  streakChanges?: ChallengeStreakChange[];
}

export interface ChallengeDTO {
  id: number;
  format: ChallengeFormat;
  status: ChallengeStatus;
  isDrinkChallenge: boolean;
  pointsToWin: number;
  handicapPoints: number;
  confirmedHandicapPoints: number | null;
  confirmedScore: string | null;
  notes: string | null;
  handicapRecipientSide: ChallengeSide;
  winnerSide: ChallengeSide | null;
  winnerId: number | null;
  createdAt: string;
  completedAt: string | null;
  youtubeUrl: string | null;
  sideA: ChallengeSideDTO;
  sideB: ChallengeSideDTO;
  bets: BetDTO[];
  resolution?: ChallengeResolutionDTO;
}

export interface CreateChallengeRequest {
  format: ChallengeFormat;
  playerAId: number;
  playerA2Id?: number;
  playerBId: number;
  playerB2Id?: number;
  isDrinkChallenge?: boolean;
  pointsToWin?: number;
  handicapPoints?: number;
  notes?: string | null;
}

export interface CreateBulkChallengesRequest {
  memberIds: number[];
  perPair?: number;
  isDrinkChallenge?: boolean;
  pointsToWin?: number;
  pin?: string;
}

export interface CreateBulkChallengesResponse {
  created: number;
}

export interface UpdateChallengeRequest {
  isDrinkChallenge?: boolean;
  pointsToWin?: number;
  handicapPoints?: number;
  notes?: string | null;
  youtubeUrl?: string | null;
}

export interface UpsertBetRequest {
  bettorId: number;
  side: ChallengeSide;
  counterpartyId: number;
}

export interface ResolveChallengeRequest {
  winnerSide: ChallengeSide;
  confirmedHandicapPoints: number;
  confirmedScore: string;
  pin?: string;
}

export interface AdminEditChallengeRequest {
  winnerSide: ChallengeSide;
  pin?: string;
}

export interface AdminDeleteChallengeRequest {
  confirmDebts?: boolean;
  pin?: string;
}

export interface StartChallengeRequest {
  pin?: string;
}

export interface VerifyPinRequest {
  pin: string;
}

export interface ResetEloRequest {
  pin?: string;
}

export interface ResetEloResult {
  count: number;
}

export interface OjBalanceDTO {
  memberId: number;
  name: string;
  avatarUrl: string | null;
  ojBalance: number;
}

export interface DrinkSettleTransactionDTO {
  id: number;
  fromMemberId: number;
  toMemberId: number;
  fromName: string;
  toName: string;
  amount: number;
  createdAt: string;
  rolledBackAt: string | null;
}

export interface OjPoolSnapshotDTO {
  balances: OjBalanceDTO[];
  transactions: DrinkSettleTransactionDTO[];
}

export interface SettleOjRequest {
  fromMemberId?: number;
  toMemberId?: number;
  /** @deprecated Prefer fromMemberId — kept for clients still sending creditorId */
  creditorId?: number;
  /** @deprecated Prefer toMemberId — kept for clients still sending debtorId */
  debtorId?: number;
  amount?: number;
  pin?: string;
}

export interface SettleOjResult {
  settled: number;
  remaining: number;
  transaction: DrinkSettleTransactionDTO;
  reason?: string;
}

export interface MemberDebtsResponse {
  member: MemberDTO;
  ojBalance: number;
  summary: MemberDebtSummary;
}

export interface MemberMatchHistoryItemDTO {
  matchId: number;
  title: string;
  venue: string;
  scheduledAt: string;
  playedFull: boolean;
  guestCount: number;
  synced: boolean;
  hours: number | null;
  totalCost: number | null;
  paidByMemberId: number | null;
  paidByName: string | null;
  shuttlecockRecipientMemberId: number | null;
  shuttlecockRecipientName: string | null;
  /** Derived shuttlecock fee when settlement hours+cost exist; else null. */
  shuttlecockFee: number | null;
  courtFee: number | null;
  /** True when remittance applies (not a single-title match, fee > 0, payer ≠ recipient). */
  shuttlecockRemittance: boolean;
}

export interface EloHistoryPointDTO {
  challengeId: number;
  completedAt: string;
  before: number;
  after: number;
  delta: number;
  won: boolean;
  score: string | null;
  opponentNames: string[];
  format: ChallengeFormat;
}

export interface MemberProfileStatsDTO {
  sessionsPlayed: number;
  singlesPlayed: number;
  singlesWins: number;
  doublesPlayed: number;
  doublesWins: number;
  peakElo: number;
  lowestElo: number;
}

export interface MemberProfileDTO {
  member: MemberDTO;
  rank: number | null;
  winRate: number;
  stats: MemberProfileStatsDTO;
  matchHistory: MemberMatchHistoryItemDTO[];
  challengeHistory: ChallengeDTO[];
  eloHistory: EloHistoryPointDTO[];
}

export interface GuestDTO {
  id: number;
  label: string | null;
  playedFull: boolean;
}

export interface RegistrationDTO {
  id: number;
  matchId: number;
  memberId: number;
  joinedAt: string;
  playedFull: boolean;
  member: MemberDTO;
  guests: GuestDTO[];
}

export interface MatchDTO {
  id: number;
  title: string;
  venue: string;
  scheduledAt: string;
  hours: number | null;
  totalCost: number | null;
  paidByMemberId: number | null;
  shuttlecockRecipientMemberId: number | null;
  isRecurring: boolean;
  recurDayOfWeek: number | null;
  synced: boolean;
  shuttlecockRemitted: boolean;
  youtubeUrl: string | null;
  registrations: RegistrationDTO[];
}

// --- Internal ledger DTOs ---

export type LedgerExpenseKind = "MATCH" | "SHUTTLECOCK" | "OPENING";
export type LedgerExpenseStatus = "OPEN" | "SETTLED";

export interface LedgerExpenseShareDTO {
  id: number;
  expenseId: number;
  memberId: number;
  memberName: string;
  owed: number;
  paid: number;
}

export interface LedgerExpenseDTO {
  id: number;
  kind: LedgerExpenseKind;
  matchId: number | null;
  title: string;
  amount: number;
  currency: string;
  paidByMemberId: number;
  paidByName: string;
  status: LedgerExpenseStatus;
  splitwiseExpenseId: number | null;
  createdAt: string;
  shares: LedgerExpenseShareDTO[];
}

export interface LedgerEdgeDTO {
  debtorId: number;
  debtorName: string;
  creditorId: number;
  creditorName: string;
  amount: number;
}

export interface LedgerBreakdownItemDTO {
  expenseId: number;
  kind: LedgerExpenseKind;
  matchId: number | null;
  title: string;
  createdAt: string;
  remainder: number;
}

export interface LedgerSnapshotDTO {
  currency: string;
  bridgeOn: boolean;
  edges: LedgerEdgeDTO[];
  expenses: LedgerExpenseDTO[];
}

export interface RecordMatchLedgerRequest {
  matchId: number;
  pin?: string;
}

export interface RecordMatchLedgerResponse {
  matchExpense: LedgerExpenseDTO | null;
  shuttlecockExpense: LedgerExpenseDTO | null;
  splitwiseSynced: boolean;
  splitwiseError: string | null;
}

export interface ImportOpeningBalancesResponse {
  created: number;
  skippedUnmapped: Array<{ splitwiseId: number; name: string; net: number }>;
  skippedZero: number;
}

export interface MarkLedgerPaidRequest {
  debtorId: number;
  creditorId: number;
  amount: number;
  pin?: string;
}

// --- Calculated share ---

export interface CalculatedShare {
  memberId: number;
  name: string;
  guestCount: number;
  guestsFactor: number;
  playedFull: boolean;
  weight: number;
  owedShare: number;
}

// --- API contract: client → /api/splitwise/expense ---

export interface CreateExpenseRequest {
  matchId?: number;
  totalCost: number;
  description: string;
  /** ISO 8601 date-time for when the expense occurred */
  date?: string;
  /** Splitwise "notes" field */
  details?: string;
  groupId: number;
  paidById: number;
  participants: Array<{
    userId: number;
    owedShare: number;
  }>;
  pin?: string;
}

// --- Splitwise flat payload (internal, route handler only) ---

export type SplitwiseFlatPayload = Record<string, string | number | boolean>;
