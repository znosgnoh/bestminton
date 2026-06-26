"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ChallengeMatchInfo from "@/components/challenges/ChallengeMatchInfo";
import HandicapEditor from "@/components/challenges/HandicapEditor";
import BettingBoard from "@/components/challenges/BettingBoard";
import ChallengeAdminControls from "@/components/challenges/ChallengeAdminControls";
import DrinkChallengeToggle from "@/components/challenges/DrinkChallengeToggle";
import ChallengeResultSummary from "@/components/challenges/ChallengeResultSummary";
import ErrorBanner from "@/components/ui/ErrorBanner";
import * as dataService from "@/lib/dataService";
import type { ChallengeDTO, ChallengeSide, MemberDTO } from "@/lib/types";

interface ChallengeDetailClientProps {
  challengeId: number;
  initialChallenge: ChallengeDTO | null;
  initialMembers: MemberDTO[];
  dbAvailable: boolean;
  dbError?: string;
}

export default function ChallengeDetailClient({
  challengeId,
  initialChallenge,
  initialMembers,
  dbAvailable,
  dbError,
}: ChallengeDetailClientProps) {
  const router = useRouter();
  const [challenge, setChallenge] = useState<ChallengeDTO | null>(initialChallenge);
  const [members, setMembers] = useState<MemberDTO[]>(initialMembers);
  const [pendingBettorId, setPendingBettorId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshMembers = useCallback(async () => {
    try {
      const updated = await dataService.getMembers();
      setMembers(updated);
    } catch {
      // non-fatal
    }
  }, []);

  const handleChallengeUpdated = useCallback(
    (updated: ChallengeDTO) => {
      setChallenge(updated);
      void refreshMembers();
      router.refresh();
    },
    [refreshMembers, router]
  );

  async function handleAddBet(
    bettorId: number,
    side: ChallengeSide,
    counterpartyId: number
  ) {
    if (!challenge || challenge.status !== "PENDING") return;

    const existingBet = challenge.bets.find((b) => b.bettorId === bettorId);
    const previousChallenge = challenge;
    const member = members.find((m) => m.id === bettorId);
    const counterparty = members.find((m) => m.id === counterpartyId);

    const optimisticBet = {
      id: existingBet?.id ?? -1,
      challengeId: challenge.id,
      bettorId,
      counterpartyId,
      side,
      amount: 1,
      bettor: {
        id: bettorId,
        name: member?.name ?? "",
        avatarUrl: member?.avatarUrl ?? null,
      },
      counterparty: counterparty
        ? { id: counterparty.id, name: counterparty.name, avatarUrl: counterparty.avatarUrl }
        : null,
    };

    const filtered = challenge.bets.filter((b) => b.bettorId !== bettorId);
    setChallenge({
      ...challenge,
      bets: [...filtered, optimisticBet],
      sideA: adjustPool(challenge.sideA, "A", side, 1, existingBet?.side),
      sideB: adjustPool(challenge.sideB, "B", side, 1, existingBet?.side),
    });

    setPendingBettorId(bettorId);
    setError(null);

    try {
      const updated = await dataService.upsertBet(
        challenge.id,
        bettorId,
        side,
        counterpartyId
      );
      setChallenge(updated);
      await refreshMembers();
    } catch (err) {
      setChallenge(previousChallenge);
      setError(err instanceof Error ? err.message : "Bet update failed.");
      throw err;
    } finally {
      setPendingBettorId(null);
    }
  }

  async function handleRemoveBet(bettorId: number) {
    if (!challenge) return;

    const existingBet = challenge.bets.find((b) => b.bettorId === bettorId);
    const previousChallenge = challenge;

    setChallenge({
      ...challenge,
      bets: challenge.bets.filter((b) => b.bettorId !== bettorId),
      sideA: adjustPool(challenge.sideA, "A", existingBet?.side ?? "A", -1),
      sideB: adjustPool(challenge.sideB, "B", existingBet?.side ?? "B", -1),
    });

    setPendingBettorId(bettorId);
    setError(null);

    try {
      const updated = await dataService.removeBet(challenge.id, bettorId);
      setChallenge(updated);
      await refreshMembers();
    } catch (err) {
      setChallenge(previousChallenge);
      setError(err instanceof Error ? err.message : "Bet update failed.");
    } finally {
      setPendingBettorId(null);
    }
  }

  if (!dbAvailable) {
    return (
      <div className="mx-auto max-w-lg px-4 py-4 space-y-4">
        <Link href="/challenges" className="tet-link">
          <ArrowLeft size={15} />
          Tất cả kèo
        </Link>
        <div className="tet-card p-8 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {dbError ?? "Kèo cần kết nối cơ sở dữ liệu trực tiếp."}
          </p>
        </div>
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="mx-auto max-w-lg px-4 py-4 space-y-4">
        <Link href="/challenges" className="tet-link">
          <ArrowLeft size={15} />
          Tất cả kèo
        </Link>
        <div className="tet-card p-8 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">Không tìm thấy kèo.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-4 space-y-4">
      <Link href="/challenges" className="tet-link">
        <ArrowLeft size={15} />
        Tất cả kèo
      </Link>

      <ChallengeMatchInfo challenge={challenge} />

      <HandicapEditor challenge={challenge} onUpdated={handleChallengeUpdated} />

      <DrinkChallengeToggle challenge={challenge} onUpdated={handleChallengeUpdated} />

      {challenge.status !== "COMPLETED" && (
        <BettingBoard
          challenge={challenge}
          members={members}
          status={challenge.status}
          pendingBettorId={pendingBettorId}
          onAddBet={handleAddBet}
          onRemoveBet={handleRemoveBet}
        />
      )}

      <ChallengeAdminControls challenge={challenge} onUpdated={handleChallengeUpdated} />
      <ChallengeResultSummary challenge={challenge} />

      {error && <ErrorBanner message={error} onRetry={() => setError(null)} />}
    </div>
  );
}

function adjustPool(
  sideDto: ChallengeDTO["sideA"],
  side: ChallengeSide,
  targetSide: ChallengeSide,
  delta: number,
  previousSide?: ChallengeSide
): ChallengeDTO["sideA"] {
  let poolTokens = sideDto.poolTokens;
  let poolBets = sideDto.poolBets;

  if (previousSide === side) {
    poolTokens -= 1;
    poolBets -= 1;
  }
  if (targetSide === side && delta > 0) {
    poolTokens += 1;
    poolBets += 1;
  } else if (targetSide === side && delta < 0) {
    poolTokens -= 1;
    poolBets -= 1;
  }

  return { ...sideDto, poolTokens, poolBets };
}
