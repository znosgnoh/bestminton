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

export interface MemberDTO {
  id: number;
  name: string;
  avatarUrl: string | null;
  splitwiseId: number | null;
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
  isRecurring: boolean;
  recurDayOfWeek: number | null;
  synced: boolean;
  registrations: RegistrationDTO[];
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
}

// --- Splitwise flat payload (internal, route handler only) ---

export type SplitwiseFlatPayload = Record<string, string | number | boolean>;
