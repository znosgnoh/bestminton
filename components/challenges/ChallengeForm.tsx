"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import AvatarTile from "@/components/matches/AvatarTile";
import ErrorBanner from "@/components/ui/ErrorBanner";
import OrangeJuiceIcon from "@/components/ui/OrangeJuiceIcon";
import { DRINK_CHALLENGE_LABEL } from "@/lib/constants";
import { sideAverageElo, sideWinProbabilities, suggestedHandicap } from "@/lib/elo";
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
  const [handicapPoints, setHandicapPoints] = useState(0);
  const [handicapTouched, setHandicapTouched] = useState(false);
  const [notes, setNotes] = useState("");
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

  const sideAAvg = useMemo(() => {
    if (format === "SINGLES") {
      if (playerAId === null) return null;
      return members.find((m) => m.id === playerAId)?.eloRating ?? null;
    }
    if (playerAId === null || playerA2Id === null) return null;
    const ratings = [playerAId, playerA2Id]
      .map((id) => members.find((m) => m.id === id)?.eloRating)
      .filter((r): r is number => r !== undefined);
    return ratings.length === 2 ? sideAverageElo(ratings) : null;
  }, [format, playerAId, playerA2Id, members]);

  const sideBAvg = useMemo(() => {
    if (format === "SINGLES") {
      if (playerBId === null) return null;
      return members.find((m) => m.id === playerBId)?.eloRating ?? null;
    }
    if (playerBId === null || playerB2Id === null) return null;
    const ratings = [playerBId, playerB2Id]
      .map((id) => members.find((m) => m.id === id)?.eloRating)
      .filter((r): r is number => r !== undefined);
    return ratings.length === 2 ? sideAverageElo(ratings) : null;
  }, [format, playerBId, playerB2Id, members]);

  const suggested =
    sideAAvg !== null && sideBAvg !== null ? suggestedHandicap(sideAAvg, sideBAvg) : null;
  const handicapRecipientSide =
    sideAAvg !== null && sideBAvg !== null ? (sideAAvg <= sideBAvg ? "A" : "B") : null;

  const winProbabilities =
    sideAAvg !== null && sideBAvg !== null && handicapRecipientSide !== null
      ? sideWinProbabilities(sideAAvg, sideBAvg, handicapPoints, handicapRecipientSide)
      : null;

  useEffect(() => {
    if (!handicapTouched && suggested !== null) {
      setHandicapPoints(suggested);
    }
  }, [suggested, handicapTouched]);

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
        handicapPoints,
        notes: notes.trim() || null,
        ...(format === "DOUBLES"
          ? { playerA2Id: playerA2Id!, playerB2Id: playerB2Id! }
          : {}),
      });
      setSuccess(true);
      onCreated(challenge.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gạ kèo thất bại.");
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
              setHandicapTouched(false);
              if (f === "DOUBLES") setIsDrinkChallenge(true);
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

      {suggested !== null && handicapRecipientSide !== null && (
        <div>
          <label className="tet-label block mb-2" htmlFor="handicap-points">
            Chấp điểm
          </label>
          <input
            id="handicap-points"
            type="number"
            min={0}
            max={21}
            step={1}
            value={handicapPoints}
            onChange={(e) => {
              setHandicapTouched(true);
              setHandicapPoints(parseInt(e.target.value, 10) || 0);
            }}
            className="tet-input w-full"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Gợi ý: {suggested} điểm cho Side {handicapRecipientSide}
            {format === "DOUBLES" && " (Elo trung bình thấp hơn)"}
          </p>
          {winProbabilities && (
            <div className="mt-3 grid grid-cols-2 gap-3 text-center text-sm">
              <div className="rounded-xl bg-amber-50/80 dark:bg-gray-800/80 p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">Win chance A</p>
                <p className="text-lg font-bold text-emerald-700 dark:text-amber-400">
                  {Math.round(winProbabilities.sideA * 100)}%
                </p>
              </div>
              <div className="rounded-xl bg-amber-50/80 dark:bg-gray-800/80 p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">Win chance B</p>
                <p className="text-lg font-bold text-emerald-700 dark:text-amber-400">
                  {Math.round(winProbabilities.sideB * 100)}%
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div>
        <label className="tet-label block mb-2" htmlFor="challenge-notes">
          Ghi chú
        </label>
        <textarea
          id="challenge-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Luật riêng, thông tin thêm…"
          className="tet-input w-full resize-y min-h-[4.5rem]"
        />
      </div>

      {format === "DOUBLES" && (
        <p className="text-xs text-gray-500 dark:text-gray-400 rounded-xl border border-amber-100/80 bg-amber-50/40 p-3 dark:border-gray-700 dark:bg-gray-800/40">
          Kèo đôi không cập nhật Elo (Elo hiện tại vẫn dùng để gợi ý chấp điểm).
        </p>
      )}

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
            {format === "DOUBLES"
              ? "Mỗi người thắng được 1 ly nước cam từ phe thua (trừ khi có cược)."
              : "Người thua mua nước cam cho người thắng khi chốt kèo (trừ khi có cược)."}
          </span>
        </span>
      </label>

      {error && <ErrorBanner message={error} onRetry={() => setError(null)} />}
      {success && (
        <div className="tet-alert-success text-sm">Gạ kèo thành công.</div>
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
          "Gạ kèo"
        )}
      </button>
    </div>
  );
}
