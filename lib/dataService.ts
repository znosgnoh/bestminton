// Client-side only. Routes data operations to the real API or local IndexedDB.
import { allowsIndexedDbFallback } from "./dbConfig";
import * as localDb from "./localDb";
import type {
  MemberDTO,
  MatchDTO,
  RegistrationDTO,
  ChallengeDTO,
  LeaderboardEntryDTO,
  CreateChallengeRequest,
  UpdateChallengeRequest,
  ChallengeSide,
  DrinkDebtDTO,
  MemberDebtsResponse,
  SettleDebtResult,
  ResetEloResult,
} from "./types";

type StorageMode = "api" | "local";

let _mode: StorageMode | null = null;
let _modePromise: Promise<StorageMode> | null = null;

async function detectMode(): Promise<StorageMode> {
  if (typeof window === "undefined") return "api";
  if (!allowsIndexedDbFallback()) return "api";
  try {
    const res = await fetch("/api/health");
    const data = (await res.json()) as { db: boolean };
    return data.db ? "api" : "local";
  } catch {
    return "local";
  }
}

export function getStorageMode(): Promise<StorageMode> {
  if (typeof window !== "undefined" && !allowsIndexedDbFallback()) {
    return Promise.resolve("api");
  }
  if (_mode) return Promise.resolve(_mode);
  if (!_modePromise) {
    _modePromise = detectMode().then((m) => {
      _mode = m;
      return m;
    });
  }
  return _modePromise;
}

async function via<T>(apiCall: () => Promise<T>, localCall: () => Promise<T>): Promise<T> {
  return (await getStorageMode()) === "api" ? apiCall() : localCall();
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  return data;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

// ---- Members ----

export function getMembers(): Promise<MemberDTO[]> {
  return via(
    () => apiFetch<MemberDTO[]>("/api/members"),
    () => localDb.getMembers()
  );
}

export function createMember(data: {
  name: string;
  avatarUrl?: string | null;
  splitwiseId?: number | null;
}): Promise<MemberDTO> {
  return via(
    () => apiFetch<MemberDTO>("/api/members", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(data) }),
    () => localDb.createMember(data)
  );
}

export function updateMember(
  id: number,
  data: {
    name: string;
    avatarUrl?: string | null;
    splitwiseId?: number | null;
    eloRating?: number;
    totalMatches?: number;
    totalWins?: number;
    pin?: string;
  }
): Promise<MemberDTO> {
  return via(
    () => apiFetch<MemberDTO>(`/api/members/${id}`, { method: "PUT", headers: JSON_HEADERS, body: JSON.stringify(data) }),
    () => localDb.updateMember(id, data)
  );
}

export async function deleteMember(id: number): Promise<void> {
  await via(
    async () => { await apiFetch<unknown>(`/api/members/${id}`, { method: "DELETE" }); },
    () => localDb.deleteMember(id)
  );
}

// ---- Matches ----

export function getMatches(): Promise<MatchDTO[]> {
  return via(
    () => apiFetch<MatchDTO[]>("/api/matches"),
    () => localDb.getMatches()
  );
}

export function getMatch(id: number): Promise<MatchDTO | null> {
  return via(
    () => apiFetch<MatchDTO>(`/api/matches/${id}`),
    () => localDb.getMatch(id)
  );
}

export function createMatches(data: {
  title: string;
  venue: string;
  scheduledAt: string;
  isRecurring: boolean;
}): Promise<MatchDTO[]> {
  return via(
    () => apiFetch<MatchDTO[]>("/api/matches", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(data) }),
    () => localDb.createMatches(data)
  );
}

export function updateMatchInfo(
  id: number,
  data: { title?: string; venue?: string; scheduledAt?: string }
): Promise<MatchDTO> {
  return via(
    () => apiFetch<MatchDTO>(`/api/matches/${id}`, { method: "PUT", headers: JSON_HEADERS, body: JSON.stringify(data) }),
    () => localDb.updateMatch(id, data)
  );
}

export function saveMatchSettlement(
  id: number,
  data: { totalCost: number; hours: number; paidByMemberId: number }
): Promise<MatchDTO> {
  return via(
    () => apiFetch<MatchDTO>(`/api/matches/${id}`, { method: "PUT", headers: JSON_HEADERS, body: JSON.stringify(data) }),
    () => localDb.updateMatch(id, data)
  );
}

export async function deleteMatch(id: number, confirmSynced: boolean): Promise<void> {
  await via(
    async () => {
      await apiFetch<unknown>(`/api/matches/${id}`, {
        method: "DELETE",
        headers: JSON_HEADERS,
        body: JSON.stringify({ confirmSynced }),
      });
    },
    () => localDb.deleteMatch(id)
  );
}

// ---- Registrations ----

export function registerMember(matchId: number, memberId: number): Promise<RegistrationDTO> {
  return via(
    () =>
      apiFetch<RegistrationDTO>(`/api/matches/${matchId}/register`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ memberId }),
      }),
    () => localDb.registerMember(matchId, memberId)
  );
}

export async function unregisterMember(matchId: number, memberId: number): Promise<void> {
  await via(
    async () => {
      await apiFetch<unknown>(`/api/matches/${matchId}/register`, {
        method: "DELETE",
        headers: JSON_HEADERS,
        body: JSON.stringify({ memberId }),
      });
    },
    () => localDb.unregisterMember(matchId, memberId)
  );
}

export function updateRegistration(
  matchId: number,
  memberId: number,
  data: { playedFull: boolean }
): Promise<RegistrationDTO> {
  return via(
    () =>
      apiFetch<RegistrationDTO>(`/api/matches/${matchId}/register`, {
        method: "PUT",
        headers: JSON_HEADERS,
        body: JSON.stringify({ memberId, ...data }),
      }),
    () => localDb.updateRegistration(matchId, memberId, data)
  );
}

// ---- Guests ----

export function addGuest(
  matchId: number,
  memberId: number,
  data: { label?: string | null; playedFull?: boolean }
): Promise<RegistrationDTO> {
  return via(
    () =>
      apiFetch<RegistrationDTO>(`/api/matches/${matchId}/guests`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ memberId, ...data }),
      }),
    () => localDb.addGuest(matchId, memberId, data)
  );
}

export function updateGuest(
  matchId: number,
  guestId: number,
  data: { playedFull: boolean }
): Promise<RegistrationDTO> {
  return via(
    () =>
      apiFetch<RegistrationDTO>(`/api/matches/${matchId}/guests/${guestId}`, {
        method: "PUT",
        headers: JSON_HEADERS,
        body: JSON.stringify(data),
      }),
    () => localDb.updateGuest(guestId, data)
  );
}

export function removeGuest(matchId: number, guestId: number): Promise<RegistrationDTO> {
  return via(
    () =>
      apiFetch<RegistrationDTO>(`/api/matches/${matchId}/guests/${guestId}`, {
        method: "DELETE",
      }),
    () => localDb.removeGuest(guestId)
  );
}

// ---- Challenges (API-only — no IndexedDB fallback) ----

async function challengeFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  return data;
}

export function getChallenges(status?: string): Promise<ChallengeDTO[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return challengeFetch<ChallengeDTO[]>(`/api/challenges${qs}`);
}

export function getChallenge(id: number): Promise<ChallengeDTO> {
  return challengeFetch<ChallengeDTO>(`/api/challenges/${id}`);
}

export function createChallenge(data: CreateChallengeRequest): Promise<ChallengeDTO> {
  return challengeFetch<ChallengeDTO>("/api/challenges", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(data),
  });
}

export function updateChallenge(
  challengeId: number,
  data: UpdateChallengeRequest
): Promise<ChallengeDTO> {
  return challengeFetch<ChallengeDTO>(`/api/challenges/${challengeId}`, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify(data),
  });
}

export function upsertBet(
  challengeId: number,
  bettorId: number,
  side: ChallengeSide,
  counterpartyId: number
): Promise<ChallengeDTO> {
  return challengeFetch<ChallengeDTO>(`/api/challenges/${challengeId}/bets`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ bettorId, side, counterpartyId }),
  });
}

export function removeBet(challengeId: number, bettorId: number): Promise<ChallengeDTO> {
  return challengeFetch<ChallengeDTO>(`/api/challenges/${challengeId}/bets/${bettorId}`, {
    method: "DELETE",
  });
}

export function startChallenge(challengeId: number, pin?: string): Promise<ChallengeDTO> {
  return challengeFetch<ChallengeDTO>(`/api/challenges/${challengeId}/start`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(pin ? { pin } : {}),
  });
}

export function resolveChallenge(
  challengeId: number,
  winnerSide: ChallengeSide,
  pin?: string
): Promise<ChallengeDTO> {
  return challengeFetch<ChallengeDTO>(`/api/challenges/${challengeId}/resolve`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ winnerSide, ...(pin ? { pin } : {}) }),
  });
}

export function adminEditChallengeWinner(
  challengeId: number,
  winnerSide: ChallengeSide,
  pin?: string
): Promise<ChallengeDTO> {
  return challengeFetch<ChallengeDTO>(`/api/challenges/${challengeId}`, {
    method: "PUT",
    headers: JSON_HEADERS,
    body: JSON.stringify({ winnerSide, ...(pin ? { pin } : {}) }),
  });
}

export async function adminDeleteChallenge(
  challengeId: number,
  options?: { confirmDebts?: boolean; pin?: string }
): Promise<{ success: boolean; debtCount: number }> {
  return challengeFetch<{ success: boolean; debtCount: number }>(`/api/challenges/${challengeId}`, {
    method: "DELETE",
    headers: JSON_HEADERS,
    body: JSON.stringify({
      confirmDebts: options?.confirmDebts,
      ...(options?.pin ? { pin: options.pin } : {}),
    }),
  });
}

export function getLeaderboard(): Promise<LeaderboardEntryDTO[]> {
  return challengeFetch<LeaderboardEntryDTO[]>("/api/leaderboard");
}

export function verifyAdminPin(pin: string): Promise<{ ok: boolean }> {
  return challengeFetch<{ ok: boolean }>("/api/admin/verify-pin", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ pin }),
  });
}

export function getPinRequired(): Promise<{ pinRequired: boolean }> {
  return challengeFetch<{ pinRequired: boolean }>("/api/admin/verify-pin");
}

export function resetAllElo(pin?: string): Promise<ResetEloResult> {
  return challengeFetch<ResetEloResult>("/api/admin/reset-elo", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(pin ? { pin } : {}),
  });
}

// ---- Drink debts (API-only — no IndexedDB fallback) ----

export function getDebts(): Promise<DrinkDebtDTO[]> {
  return challengeFetch<DrinkDebtDTO[]>("/api/debts");
}

export function getMemberDebts(memberId: number): Promise<MemberDebtsResponse> {
  return challengeFetch<MemberDebtsResponse>(`/api/members/${memberId}/debts`);
}

export function settleDebt(data: {
  debtorId: number;
  creditorId: number;
  amount?: number;
  pin?: string;
}): Promise<SettleDebtResult> {
  return challengeFetch<SettleDebtResult>("/api/debts/settle", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(data),
  });
}
