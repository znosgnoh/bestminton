"use client";

import { useCallback, useReducer } from "react";
function computeWeight(hours: number, guests: number): number {
  return hours * (1 + guests);
}
import type {
  AttendanceRecord,
  CalculatedShare,
  SessionState,
  SplitwiseMember,
} from "@/lib/types";

// Legacy share calculator for the SPA flow (AttendanceRecord[], per-member hours)
function calculateShares(
  attendance: AttendanceRecord[],
  totalCost: number
): CalculatedShare[] {
  const present = attendance.filter((r) => r.present);
  if (!present.length || totalCost <= 0) return [];
  const totalWeight = present.reduce((s, r) => s + computeWeight(r.hours, r.guests), 0);
  const shares: CalculatedShare[] = present.map((r) => {
    const weight = computeWeight(r.hours, r.guests);
    return {
      memberId: r.memberId,
      name: `${r.firstName} ${r.lastName}`.trim(),
      guestCount: r.guests,
      guestsFactor: r.guests,
      playedFull: true,
      weight,
      owedShare: Math.round((totalCost * weight / totalWeight) * 100) / 100,
    };
  });
  const sumCents = shares.reduce((s, r) => s + Math.round(r.owedShare * 100), 0);
  const diff = Math.round(totalCost * 100) - sumCents;
  if (diff !== 0) shares[0].owedShare = Math.round((shares[0].owedShare + diff / 100) * 100) / 100;
  return shares;
}

type Action =
  | { type: "SET_TOTAL_COST"; value: number }
  | { type: "GO_TO_ATTENDANCE" }
  | { type: "MEMBERS_LOADING" }
  | { type: "MEMBERS_SUCCESS"; members: SplitwiseMember[] }
  | { type: "MEMBERS_ERROR"; error: string }
  | { type: "ADD_MANUAL_MEMBER"; name: string }
  | { type: "REMOVE_MANUAL_MEMBER"; id: number }
  | { type: "TOGGLE_ATTENDANCE"; id: number }
  | { type: "SET_HOURS"; id: number; value: number }
  | { type: "SET_GUESTS"; id: number; value: number }
  | { type: "SET_PAYER"; id: number }
  | { type: "GO_TO_REVIEW" }
  | { type: "GO_BACK_TO_ATTENDANCE" }
  | { type: "GO_BACK_TO_INIT" }
  | { type: "SYNC_START" }
  | { type: "SYNC_SUCCESS" }
  | { type: "SYNC_ERROR"; error: string }
  | { type: "RESET" };

const initialState: SessionState = {
  step: "init",
  totalCost: "",
  paidById: null,
  members: [],
  attendance: [],
  membersLoading: false,
  membersError: null,
  syncStatus: "idle",
  syncError: null,
};

// Manual members use negative IDs to distinguish from real Splitwise IDs
let manualIdCounter = -1;

function makeAttendanceRecord(
  id: number,
  firstName: string,
  lastName: string,
  isManual: boolean
): AttendanceRecord {
  return { memberId: id, firstName, lastName, present: false, hours: 0, guests: 0, isManual };
}

function reducer(state: SessionState, action: Action): SessionState {
  switch (action.type) {
    case "SET_TOTAL_COST":
      return { ...state, totalCost: action.value };

    case "GO_TO_ATTENDANCE":
      return { ...state, step: "attendance" };

    case "MEMBERS_LOADING":
      return { ...state, membersLoading: true, membersError: null };

    case "MEMBERS_SUCCESS": {
      // Merge Splitwise members with existing manual entries; keep manual ones
      const manualRecords = state.attendance.filter((r) => r.isManual);
      const existingSplitwiseIds = new Set(
        state.attendance.filter((r) => !r.isManual).map((r) => r.memberId)
      );
      const newRecords = action.members
        .filter((m) => !existingSplitwiseIds.has(m.id))
        .map((m) => makeAttendanceRecord(m.id, m.first_name, m.last_name, false));

      return {
        ...state,
        members: action.members,
        attendance: [...newRecords, ...state.attendance.filter((r) => !r.isManual), ...manualRecords],
        membersLoading: false,
        membersError: null,
      };
    }

    case "MEMBERS_ERROR":
      return { ...state, membersLoading: false, membersError: action.error };

    case "ADD_MANUAL_MEMBER": {
      const parts = action.name.trim().split(/\s+/);
      const firstName = parts[0];
      const lastName = parts.slice(1).join(" ") || "";
      const id = manualIdCounter--;
      return {
        ...state,
        attendance: [
          ...state.attendance,
          makeAttendanceRecord(id, firstName, lastName, true),
        ],
      };
    }

    case "REMOVE_MANUAL_MEMBER": {
      const newAttendance = state.attendance.filter((r) => r.memberId !== action.id);
      const newPaidById =
        state.paidById === action.id ? null : state.paidById;
      return { ...state, attendance: newAttendance, paidById: newPaidById };
    }

    case "TOGGLE_ATTENDANCE": {
      const updated = state.attendance.map((r) =>
        r.memberId === action.id
          ? { ...r, present: !r.present, hours: r.present ? 0 : r.hours, guests: r.present ? 0 : r.guests }
          : r
      );
      // Clear payer if they were unchecked
      const toggled = updated.find((r) => r.memberId === action.id);
      const paidById = toggled && !toggled.present && state.paidById === action.id
        ? null
        : state.paidById;
      return { ...state, attendance: updated, paidById };
    }

    case "SET_HOURS":
      return {
        ...state,
        attendance: state.attendance.map((r) =>
          r.memberId === action.id ? { ...r, hours: action.value } : r
        ),
      };

    case "SET_GUESTS":
      return {
        ...state,
        attendance: state.attendance.map((r) =>
          r.memberId === action.id ? { ...r, guests: action.value } : r
        ),
      };

    case "SET_PAYER":
      return { ...state, paidById: action.id };

    case "GO_TO_REVIEW":
      return { ...state, step: "review" };

    case "GO_BACK_TO_ATTENDANCE":
      return { ...state, step: "attendance", syncStatus: "idle", syncError: null };

    case "GO_BACK_TO_INIT":
      return { ...state, step: "init" };

    case "SYNC_START":
      return { ...state, syncStatus: "syncing", syncError: null };

    case "SYNC_SUCCESS":
      return { ...state, syncStatus: "success" };

    case "SYNC_ERROR":
      return { ...state, syncStatus: "error", syncError: action.error };

    case "RESET":
      manualIdCounter = -1;
      return { ...initialState };

    default:
      return state;
  }
}

export function useSessionState() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const goToAttendanceStep = useCallback((totalCost: number) => {
    dispatch({ type: "SET_TOTAL_COST", value: totalCost });
    dispatch({ type: "GO_TO_ATTENDANCE" });
  }, []);

  const loadMembersFromSplitwise = useCallback(async () => {
    dispatch({ type: "MEMBERS_LOADING" });
    try {
      const res = await fetch("/api/splitwise/members");
      const data = await res.json() as { members?: SplitwiseMember[]; error?: string };
      if (!res.ok || data.error) {
        dispatch({ type: "MEMBERS_ERROR", error: data.error ?? "Failed to load members." });
      } else {
        dispatch({ type: "MEMBERS_SUCCESS", members: data.members! });
      }
    } catch {
      dispatch({ type: "MEMBERS_ERROR", error: "Could not reach the server." });
    }
  }, []);

  const addManualMember = useCallback((name: string) => {
    dispatch({ type: "ADD_MANUAL_MEMBER", name });
  }, []);

  const removeManualMember = useCallback((id: number) => {
    dispatch({ type: "REMOVE_MANUAL_MEMBER", id });
  }, []);

  const toggleAttendance = useCallback((id: number) => {
    dispatch({ type: "TOGGLE_ATTENDANCE", id });
  }, []);

  const setHours = useCallback((id: number, value: number) => {
    dispatch({ type: "SET_HOURS", id, value });
  }, []);

  const setGuests = useCallback((id: number, value: number) => {
    dispatch({ type: "SET_GUESTS", id, value });
  }, []);

  const setPayer = useCallback((id: number) => {
    dispatch({ type: "SET_PAYER", id });
  }, []);

  const goToReview = useCallback(() => {
    dispatch({ type: "GO_TO_REVIEW" });
  }, []);

  const goBack = useCallback((from: "attendance" | "review") => {
    dispatch({ type: from === "review" ? "GO_BACK_TO_ATTENDANCE" : "GO_BACK_TO_INIT" });
  }, []);

  const syncExpense = useCallback(async () => {
    if (typeof state.totalCost !== "number" || !state.paidById) return;
    const shares = calculateShares(state.attendance, state.totalCost);
    dispatch({ type: "SYNC_START" });

    const today = new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    try {
      const res = await fetch("/api/splitwise/expense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalCost: state.totalCost,
          description: `Badminton – ${today}`,
          groupId: 0, // resolved server-side via SPLITWISE_GROUP_ID
          paidById: state.paidById,
          participants: shares.map((s) => ({ userId: s.memberId, owedShare: s.owedShare })),
        }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok || data.error) {
        dispatch({ type: "SYNC_ERROR", error: data.error ?? "Sync failed. Please try again." });
      } else {
        dispatch({ type: "SYNC_SUCCESS" });
      }
    } catch {
      dispatch({ type: "SYNC_ERROR", error: "Could not reach the server." });
    }
  }, [state.totalCost, state.paidById, state.attendance]);

  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  // Derived
  const presentMembers = state.attendance.filter((r) => r.present);

  const shares: CalculatedShare[] =
    presentMembers.length > 0 && typeof state.totalCost === "number"
      ? calculateShares(state.attendance, state.totalCost)
      : [];

  const payerMember = state.attendance.find((r) => r.memberId === state.paidById);
  const paidByName = payerMember
    ? `${payerMember.firstName} ${payerMember.lastName}`.trim()
    : "";

  // Sync is only possible when all present members have real Splitwise IDs
  const hasManualMembers = presentMembers.some((r) => r.isManual);
  const canSync = !hasManualMembers && state.paidById !== null && presentMembers.length > 0;

  return {
    state,
    shares,
    paidByName,
    canSync,
    hasManualMembers,
    actions: {
      goToAttendanceStep,
      loadMembersFromSplitwise,
      addManualMember,
      removeManualMember,
      toggleAttendance,
      setHours,
      setGuests,
      setPayer,
      goToReview,
      goBack,
      syncExpense,
      reset,
    },
  };
}
