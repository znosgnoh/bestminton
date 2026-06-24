"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import AvatarTile from "@/components/matches/AvatarTile";
import ErrorBanner from "@/components/ui/ErrorBanner";
import OrangeJuiceIcon from "@/components/ui/OrangeJuiceIcon";
import { DRINK_CHALLENGE_LABEL } from "@/lib/constants";
import * as dataService from "@/lib/dataService";
import type { ChallengeFormat, MemberDTO } from "@/lib/types";

interface ChallengeFormProps {
  members: MemberDTO[];
  onCreated: (id: number) => void;
}

export default function ChallengeForm({ members, onCreated }: ChallengeFormProps) {
  const [format, setFormat] = useState<ChallengeFormat>("SINGLES");
  const [playerAId, setPlayerAId] = useState<number | null>(null);
  const [playerA2Id, setPlayerA2Id] = useState<number | null>(null);
  const [playerBId, setPlayerBId] = useState<number | null>(null);
  const [playerB2Id, setPlayerB2Id] = useState<number | null>(null);
  const [isDrinkChallenge, setIsDrinkChallenge] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const selectedIds = new Set(
    [playerAId, playerA2Id, playerBId, playerB2Id].filter((id): id is number => id !== null)
  );

  function toggleSlot(
    slot: "A" | "A2" | "B" | "B2",
    memberId: number
  ) {
    const map = {
      A: [playerAId, setPlayerAId] as const,
      A2: [playerA2Id, setPlayerA2Id] as const,
      B: [playerBId, setPlayerBId] as const,
      B2: [playerB2Id, setPlayerB2Id] as const,
    };
    const [current, setter] = map[slot];
    if (current === memberId) {
      setter(null);
    } else if (!selectedIds.has(memberId) || current === memberId) {
      setter(memberId);
    }
  }

  function isSelectedInOtherSlot(memberId: number, slot: "A" | "A2" | "B" | "B2"): boolean {
    const slots: Record<string, number | null> = {
      A: playerAId,
      A2: playerA2Id,
      B: playerBId,
      B2: playerB2Id,
    };
    return Object.entries(slots).some(([key, id]) => key !== slot && id === memberId);
  }

  const canSubmit =
    format === "SINGLES"
      ? playerAId !== null && playerBId !== null && playerAId !== playerBId
      : playerAId !== null &&
        playerA2Id !== null &&
        playerBId !== null &&
        playerB2Id !== null &&
        new Set([playerAId, playerA2Id, playerBId, playerB2Id]).size === 4;

  async function handleSubmit() {
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const challenge = await dataService.createChallenge({
        format,
        playerAId: playerAId!,
        playerBId: playerBId!,
        isDrinkChallenge,
        ...(format === "DOUBLES"
          ? { playerA2Id: playerA2Id!, playerB2Id: playerB2Id! }
          : {}),
      });
      setSuccess(true);
      onCreated(challenge.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create challenge.");
    } finally {
      setSubmitting(false);
    }
  }

  function renderPicker(
    label: string,
    slot: "A" | "A2" | "B" | "B2",
    selectedId: number | null
  ) {
    return (
      <div>
        <p className="tet-label mb-2">{label}</p>
        <div className="grid grid-cols-4 gap-1 sm:grid-cols-5">
          {members.map((m) => {
            const disabled = isSelectedInOtherSlot(m.id, slot);
            const selected = selectedId === m.id;
            return (
              <AvatarTile
                key={`${slot}-${m.id}`}
                member={m}
                registered={selected}
                disabled={disabled}
                onToggle={() => toggleSlot(slot, m.id)}
              />
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        {(["SINGLES", "DOUBLES"] as ChallengeFormat[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => {
              setFormat(f);
              setPlayerA2Id(null);
              setPlayerB2Id(null);
            }}
            className={format === f ? "tet-tab-active flex-1 tet-tab" : "tet-tab-inactive flex-1 tet-tab"}
          >
            {f === "SINGLES" ? "1v1" : "2v2"}
          </button>
        ))}
      </div>

      {renderPicker("Side A", "A", playerAId)}
      {format === "DOUBLES" && renderPicker("Side A Partner", "A2", playerA2Id)}
      {renderPicker("Side B", "B", playerBId)}
      {format === "DOUBLES" && renderPicker("Side B Partner", "B2", playerB2Id)}

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-100/80 bg-amber-50/40 p-3 dark:border-gray-700 dark:bg-gray-800/40">
        <input
          type="checkbox"
          checked={isDrinkChallenge}
          onChange={(e) => setIsDrinkChallenge(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
        />
        <span className="flex-1">
          <span className="flex items-center gap-1.5 text-sm font-medium text-gray-900 dark:text-gray-100">
            <OrangeJuiceIcon size={16} className="text-orange-500 dark:text-orange-400" />
            {DRINK_CHALLENGE_LABEL}
          </span>
          <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
            Winner gets nước cam from loser when resolved (unless bets are placed).
          </span>
        </span>
      </label>

      {error && <ErrorBanner message={error} onRetry={() => setError(null)} />}
      {success && (
        <div className="tet-alert-success text-sm">Challenge created successfully.</div>
      )}

      <button
        type="button"
        onClick={() => void handleSubmit()}
        disabled={!canSubmit || submitting}
        className="tet-btn-primary-lg w-full"
      >
        {submitting ? (
          <Loader2 size={20} className="mx-auto animate-spin" />
        ) : (
          "Create Challenge"
        )}
      </button>
    </div>
  );
}
