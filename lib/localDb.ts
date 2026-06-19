// IndexedDB-backed data store — browser only.
// Returns the same DTO shapes as the API routes so components work identically.
import {
  idbGetAll,
  idbGetById,
  idbGetByIndex,
  idbAdd,
  idbPut,
  idbDelete,
} from "./idb";
import type { MemberDTO, MatchDTO, RegistrationDTO, GuestDTO } from "./types";

// ---- Raw storage shapes (no relations) ----

interface RawMember {
  id: number;
  name: string;
  avatarUrl: string | null;
  splitwiseId: number | null;
  createdAt: string;
}

interface RawMatch {
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
  createdAt: string;
}

interface RawRegistration {
  id: number;
  matchId: number;
  memberId: number;
  joinedAt: string;
  playedFull: boolean;
}

interface RawGuest {
  id: number;
  label: string | null;
  registrationId: number;
  playedFull: boolean;
}

// ---- Join helpers ----

async function buildRegistrationDTO(reg: RawRegistration): Promise<RegistrationDTO> {
  const member = await idbGetById<RawMember>("members", reg.memberId);
  const rawGuests = await idbGetByIndex<RawGuest>("guests", "registrationId", reg.id);
  return {
    id: reg.id,
    matchId: reg.matchId,
    memberId: reg.memberId,
    joinedAt: reg.joinedAt,
    playedFull: reg.playedFull,
    member: member
      ? { id: member.id, name: member.name, avatarUrl: member.avatarUrl, splitwiseId: member.splitwiseId }
      : { id: reg.memberId, name: "Unknown", avatarUrl: null, splitwiseId: null },
    guests: rawGuests.map((g): GuestDTO => ({ id: g.id, label: g.label, playedFull: g.playedFull })),
  };
}

async function buildMatchDTO(match: RawMatch): Promise<MatchDTO> {
  const rawRegs = await idbGetByIndex<RawRegistration>("registrations", "matchId", match.id);
  const regDTOs = await Promise.all(rawRegs.map(buildRegistrationDTO));
  regDTOs.sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
  return {
    id: match.id,
    title: match.title,
    venue: match.venue,
    scheduledAt: match.scheduledAt,
    hours: match.hours,
    totalCost: match.totalCost,
    paidByMemberId: match.paidByMemberId,
    isRecurring: match.isRecurring,
    recurDayOfWeek: match.recurDayOfWeek,
    synced: match.synced,
    registrations: regDTOs,
  };
}

// ---- Members ----

export async function getMembers(): Promise<MemberDTO[]> {
  const raw = await idbGetAll<RawMember>("members");
  return raw
    .map((m): MemberDTO => ({ id: m.id, name: m.name, avatarUrl: m.avatarUrl, splitwiseId: m.splitwiseId }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function createMember(data: {
  name: string;
  avatarUrl?: string | null;
  splitwiseId?: number | null;
}): Promise<MemberDTO> {
  const id = await idbAdd("members", {
    name: data.name,
    avatarUrl: data.avatarUrl ?? null,
    splitwiseId: data.splitwiseId ?? null,
    createdAt: new Date().toISOString(),
  });
  return { id, name: data.name, avatarUrl: data.avatarUrl ?? null, splitwiseId: data.splitwiseId ?? null };
}

export async function updateMember(
  id: number,
  data: { name: string; avatarUrl?: string | null; splitwiseId?: number | null }
): Promise<MemberDTO> {
  const existing = await idbGetById<RawMember>("members", id);
  if (!existing) throw new Error("Member not found.");
  await idbPut("members", { ...existing, name: data.name, avatarUrl: data.avatarUrl ?? null, splitwiseId: data.splitwiseId ?? null });
  return { id, name: data.name, avatarUrl: data.avatarUrl ?? null, splitwiseId: data.splitwiseId ?? null };
}

export async function deleteMember(id: number): Promise<void> {
  await idbDelete("members", id);
}

// ---- Matches ----

export async function getMatches(): Promise<MatchDTO[]> {
  const raw = await idbGetAll<RawMatch>("matches");
  const dtos = await Promise.all(raw.map(buildMatchDTO));
  return dtos.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
}

export async function getMatch(id: number): Promise<MatchDTO | null> {
  const raw = await idbGetById<RawMatch>("matches", id);
  if (!raw) return null;
  return buildMatchDTO(raw);
}

export async function createMatches(data: {
  title: string;
  venue: string;
  scheduledAt: string;
  isRecurring: boolean;
}): Promise<MatchDTO[]> {
  const base = new Date(data.scheduledAt);
  const dayOfWeek = base.getDay();
  const offsets = data.isRecurring ? [0, 7, 14, 21] : [0];
  const results: MatchDTO[] = [];
  for (const days of offsets) {
    const d = new Date(base.getTime() + days * 86400000);
    const raw: Omit<RawMatch, "id"> = {
      title: data.title,
      venue: data.venue,
      scheduledAt: d.toISOString(),
      hours: null,
      totalCost: null,
      paidByMemberId: null,
      isRecurring: data.isRecurring,
      recurDayOfWeek: data.isRecurring ? dayOfWeek : null,
      synced: false,
      createdAt: new Date().toISOString(),
    };
    const id = await idbAdd("matches", raw);
    results.push(await buildMatchDTO({ ...raw, id }));
  }
  return results;
}

export async function updateMatch(
  id: number,
  data: {
    title?: string;
    venue?: string;
    scheduledAt?: string;
    hours?: number | null;
    totalCost?: number | null;
    paidByMemberId?: number | null;
  }
): Promise<MatchDTO> {
  const existing = await idbGetById<RawMatch>("matches", id);
  if (!existing) throw new Error("Match not found.");
  const updated = { ...existing, ...data };
  await idbPut("matches", updated);
  return buildMatchDTO(updated);
}

export async function deleteMatch(id: number): Promise<void> {
  const regs = await idbGetByIndex<RawRegistration>("registrations", "matchId", id);
  for (const reg of regs) {
    const guests = await idbGetByIndex<RawGuest>("guests", "registrationId", reg.id);
    for (const g of guests) await idbDelete("guests", g.id);
    await idbDelete("registrations", reg.id);
  }
  await idbDelete("matches", id);
}

// ---- Registrations ----

export async function registerMember(matchId: number, memberId: number): Promise<RegistrationDTO> {
  const raw: Omit<RawRegistration, "id"> = {
    matchId,
    memberId,
    joinedAt: new Date().toISOString(),
    playedFull: true,
  };
  const id = await idbAdd("registrations", raw);
  return buildRegistrationDTO({ ...raw, id });
}

export async function unregisterMember(matchId: number, memberId: number): Promise<void> {
  const regs = await idbGetByIndex<RawRegistration>("registrations", "matchId", matchId);
  const reg = regs.find((r) => r.memberId === memberId);
  if (!reg) return;
  const guests = await idbGetByIndex<RawGuest>("guests", "registrationId", reg.id);
  for (const g of guests) await idbDelete("guests", g.id);
  await idbDelete("registrations", reg.id);
}

export async function updateRegistration(
  matchId: number,
  memberId: number,
  data: { playedFull: boolean }
): Promise<RegistrationDTO> {
  const regs = await idbGetByIndex<RawRegistration>("registrations", "matchId", matchId);
  const reg = regs.find((r) => r.memberId === memberId);
  if (!reg) throw new Error("Registration not found.");
  const updated = { ...reg, ...data };
  await idbPut("registrations", updated);
  return buildRegistrationDTO(updated);
}

// ---- Guests ----

export async function addGuest(
  matchId: number,
  memberId: number,
  data: { label?: string | null; playedFull?: boolean }
): Promise<RegistrationDTO> {
  const regs = await idbGetByIndex<RawRegistration>("registrations", "matchId", matchId);
  const reg = regs.find((r) => r.memberId === memberId);
  if (!reg) throw new Error("Registration not found.");
  await idbAdd("guests", {
    registrationId: reg.id,
    label: data.label?.trim() || null,
    playedFull: data.playedFull ?? true,
  });
  return buildRegistrationDTO(reg);
}

export async function updateGuest(
  guestId: number,
  data: { playedFull: boolean }
): Promise<RegistrationDTO> {
  const guest = await idbGetById<RawGuest>("guests", guestId);
  if (!guest) throw new Error("Guest not found.");
  await idbPut("guests", { ...guest, ...data });
  const reg = await idbGetById<RawRegistration>("registrations", guest.registrationId);
  if (!reg) throw new Error("Registration not found.");
  return buildRegistrationDTO(reg);
}

export async function removeGuest(guestId: number): Promise<RegistrationDTO> {
  const guest = await idbGetById<RawGuest>("guests", guestId);
  if (!guest) throw new Error("Guest not found.");
  const regId = guest.registrationId;
  await idbDelete("guests", guestId);
  const reg = await idbGetById<RawRegistration>("registrations", regId);
  if (!reg) throw new Error("Registration not found.");
  return buildRegistrationDTO(reg);
}
