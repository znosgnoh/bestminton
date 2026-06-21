"use client";

import { useState } from "react";
import AvatarTile from "./AvatarTile";
import ErrorBanner from "@/components/ui/ErrorBanner";
import * as dataService from "@/lib/dataService";
import type { MemberDTO, RegistrationDTO } from "@/lib/types";

interface MemberRosterProps {
  matchId: number;
  allMembers: MemberDTO[];
  registrations: RegistrationDTO[];
  setRegistrations: (updater: (prev: RegistrationDTO[]) => RegistrationDTO[]) => void;
  isPast: boolean;
}

function buildOptimisticRegistration(
  member: MemberDTO,
  matchId: number
): RegistrationDTO {
  return {
    id: -(Date.now()),
    matchId,
    memberId: member.id,
    joinedAt: new Date().toISOString(),
    playedFull: true,
    member,
    guests: [],
  };
}

export default function MemberRoster({
  matchId,
  allMembers,
  registrations,
  setRegistrations,
  isPast,
}: MemberRosterProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Set<number>>(new Set());

  async function handleToggle(member: MemberDTO) {
    if (isPast || pending.has(member.id)) return;
    setError(null);

    const isRegistered = registrations.some((r) => r.memberId === member.id);
    const snapshot = [...registrations];

    if (isRegistered) {
      setRegistrations((prev) => prev.filter((r) => r.memberId !== member.id));
    } else {
      setRegistrations((prev) => [...prev, buildOptimisticRegistration(member, matchId)]);
    }

    setPending((prev) => new Set(prev).add(member.id));

    try {
      if (isRegistered) {
        await dataService.unregisterMember(matchId, member.id);
      } else {
        const real = await dataService.registerMember(matchId, member.id);
        setRegistrations((prev) =>
          prev.map((r) => (r.memberId === member.id ? real : r))
        );
      }
    } catch (err) {
      setRegistrations(() => snapshot);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(member.id);
        return next;
      });
    }
  }

  if (allMembers.length === 0) {
    return (
      <div className="tet-card p-5">
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center py-4">
          No members added yet. Ask the captain to add members in{" "}
          <a href="/management" className="tet-link-accent">
            Management
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="tet-card p-4">
      <h2 className="tet-section-title text-sm mb-3">
        {isPast ? "Players" : "Tap to register"}
      </h2>
      {error && (
        <div className="mb-3">
          <ErrorBanner message={error} onRetry={() => setError(null)} />
        </div>
      )}
      <div className="flex flex-wrap gap-1">
        {allMembers.map((member) => {
          const reg = registrations.find((r) => r.memberId === member.id);
          return (
            <AvatarTile
              key={member.id}
              member={member}
              registered={!!reg}
              playedFull={reg?.playedFull}
              disabled={isPast || pending.has(member.id)}
              onToggle={() => handleToggle(member)}
            />
          );
        })}
      </div>
    </div>
  );
}
