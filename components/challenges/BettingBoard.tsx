"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import OrangeJuiceIcon from "@/components/ui/OrangeJuiceIcon";
import { DRINK_LABEL_SHORT, formatDrinkAmount } from "@/lib/constants";
import type { BetDTO, ChallengeDTO, ChallengeSide, MemberDTO } from "@/lib/types";

interface BettingBoardProps {
  challenge: ChallengeDTO;
  members: MemberDTO[];
  status: ChallengeDTO["status"];
  pendingBettorId: number | null;
  onAddBet: (bettorId: number, side: ChallengeSide, counterpartyId: number) => Promise<void>;
  onRemoveBet: (bettorId: number) => Promise<void>;
}

const selectCls = "tet-input w-full";

function challengePlayerIds(challenge: ChallengeDTO): Set<number> {
  const ids = new Set<number>();
  for (const p of challenge.sideA.players) ids.add(p.id);
  for (const p of challenge.sideB.players) ids.add(p.id);
  return ids;
}

function formatPlayerNames(players: ChallengeDTO["sideA"]["players"]): string {
  return players.map((p) => p.name).join(" & ");
}

function MatchupHeader({ challenge }: { challenge: ChallengeDTO }) {
  const totalBets = challenge.sideA.poolBets + challenge.sideB.poolBets;
  const totalTokens = challenge.sideA.poolTokens + challenge.sideB.poolTokens;

  return (
    <div className="rounded-xl border border-amber-100/80 bg-amber-50/40 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-800/40">
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-xs">
        <span className="font-semibold text-gray-700 dark:text-gray-300">
          Side A: {formatPlayerNames(challenge.sideA.players)}
        </span>
        <span className="text-gray-400 dark:text-gray-500">vs</span>
        <span className="font-semibold text-gray-700 dark:text-gray-300">
          Side B: {formatPlayerNames(challenge.sideB.players)}
        </span>
      </div>
      {totalBets > 0 && (
        <p className="mt-1.5 flex items-center justify-center gap-1 text-[10px] text-gray-500 dark:text-gray-400">
          <OrangeJuiceIcon size={10} className="text-orange-500 dark:text-orange-400" />
          {totalBets} bet{totalBets !== 1 ? "s" : ""} · {formatDrinkAmount(totalTokens)}
        </p>
      )}
    </div>
  );
}

function BetRow({
  bet,
  betsLocked,
  pending,
  onRemove,
}: {
  bet: BetDTO;
  betsLocked: boolean;
  pending: boolean;
  onRemove: () => void;
}) {
  return (
    <li className="flex items-center gap-2 rounded-lg border border-amber-100/80 bg-white/60 px-2.5 py-2 dark:border-gray-700 dark:bg-gray-900/40">
      <Avatar name={bet.bettor.name} avatarUrl={bet.bettor.avatarUrl} size="sm" />
      <p className="min-w-0 flex-1 truncate text-xs font-medium text-gray-800 dark:text-gray-200">
        {bet.bettor.name} backs {bet.side} vs {bet.counterparty?.name ?? "—"}
      </p>
      {!betsLocked && (
        <button
          type="button"
          onClick={onRemove}
          disabled={pending}
          aria-label={`Remove bet by ${bet.bettor.name}`}
          className="shrink-0 rounded p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/40 dark:hover:text-red-400"
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
        </button>
      )}
    </li>
  );
}

function MemberDropdown({
  label,
  members,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  label: string;
  members: MemberDTO[];
  value: number | null;
  onChange: (id: number | null) => void;
  disabled?: boolean;
  placeholder: string;
}) {
  return (
    <div className="space-y-1">
      <label className="tet-label text-[10px]">{label}</label>
      <select
        value={value ?? ""}
        disabled={disabled || members.length === 0}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        className={selectCls}
      >
        <option value="">{members.length === 0 ? "No one available" : placeholder}</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function BettingBoard({
  challenge,
  members,
  status,
  pendingBettorId,
  onAddBet,
  onRemoveBet,
}: BettingBoardProps) {
  const [betSide, setBetSide] = useState<ChallengeSide>("A");
  const [bettorId, setBettorId] = useState<number | null>(null);
  const [counterpartyId, setCounterpartyId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const betsLocked = status !== "PENDING";
  const playerIds = useMemo(() => challengePlayerIds(challenge), [challenge]);

  const existingBettorIds = useMemo(
    () => new Set(challenge.bets.map((b) => b.bettorId)),
    [challenge.bets]
  );

  const eligibleBettors = useMemo(
    () => members.filter((m) => !playerIds.has(m.id) && !existingBettorIds.has(m.id)),
    [members, playerIds, existingBettorIds]
  );

  const counterpartyOptions = useMemo(() => {
    if (bettorId == null) return [];
    return members.filter((m) => !playerIds.has(m.id) && m.id !== bettorId);
  }, [members, playerIds, bettorId]);

  useEffect(() => {
    setCounterpartyId(null);
  }, [bettorId]);

  const canAdd =
    !betsLocked &&
    !submitting &&
    bettorId != null &&
    counterpartyId != null &&
    bettorId !== counterpartyId;

  async function handleAdd() {
    if (!canAdd || bettorId == null || counterpartyId == null) return;
    setSubmitting(true);
    try {
      await onAddBet(bettorId, betSide, counterpartyId);
      setBettorId(null);
      setCounterpartyId(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="tet-card space-y-4 p-4">
      <div>
        <h2 className="tet-section-title text-sm">Place Your Bets</h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Pick who is betting and who they&apos;re betting against — 1 {DRINK_LABEL_SHORT} per bet.
          If your side wins, they owe you; if it loses, you owe them.
        </p>
      </div>

      {betsLocked && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Betting is locked — challenge is {status.toLowerCase()}.
        </p>
      )}

      <MatchupHeader challenge={challenge} />

      {!betsLocked && (
        <div className="space-y-3 rounded-xl border border-amber-100/80 p-3 dark:border-gray-700">
          <MemberDropdown
            label="Bettor"
            members={eligibleBettors}
            value={bettorId}
            onChange={setBettorId}
            placeholder="— Select bettor —"
          />

          <MemberDropdown
            label="Counterparty"
            members={counterpartyOptions}
            value={counterpartyId}
            onChange={setCounterpartyId}
            disabled={bettorId == null}
            placeholder="— Select counterparty —"
          />

          <div className="space-y-1">
            <label className="tet-label text-[10px]">Backing</label>
            <select
              value={betSide}
              onChange={(e) => setBetSide(e.target.value as ChallengeSide)}
              className={selectCls}
            >
              <option value="A">Side A — {formatPlayerNames(challenge.sideA.players)}</option>
              <option value="B">Side B — {formatPlayerNames(challenge.sideB.players)}</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => void handleAdd()}
            disabled={!canAdd}
            className="tet-btn-primary w-full"
          >
            {submitting ? (
              <Loader2 size={18} className="mx-auto animate-spin" />
            ) : (
              <span className="inline-flex items-center justify-center gap-1.5">
                <OrangeJuiceIcon size={14} />
                Add bet
              </span>
            )}
          </button>
        </div>
      )}

      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300">Current bets</h3>
        {challenge.bets.length > 0 ? (
          <ul className="space-y-1.5">
            {challenge.bets.map((bet) => (
              <BetRow
                key={bet.id}
                bet={bet}
                betsLocked={betsLocked}
                pending={pendingBettorId === bet.bettorId}
                onRemove={() => void onRemoveBet(bet.bettorId)}
              />
            ))}
          </ul>
        ) : (
          <p className="text-center text-[10px] text-gray-500 dark:text-gray-400">No bets yet</p>
        )}
      </div>
    </div>
  );
}
