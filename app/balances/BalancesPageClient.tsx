"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet } from "lucide-react";
import { pairDirectRemainder } from "@/components/balances/BalanceBreakdown";
import BalanceGroupTab from "@/components/balances/BalanceGroupTab";
import BalanceMeTab from "@/components/balances/BalanceMeTab";
import { useRegisterPullToRefresh } from "@/components/PullToRefresh";
import AdminPinModal from "@/components/ui/AdminPinModal";
import ErrorBanner from "@/components/ui/ErrorBanner";
import PageLoader from "@/components/ui/PageLoader";
import { useAdminPin } from "@/hooks/useAdminPin";
import { useI18n } from "@/contexts/LocaleContext";
import { formatCurrency } from "@/lib/currency";
import * as dataService from "@/lib/dataService";
import { toCents } from "@/lib/ledgerMath";
import type { LedgerEdgeDTO, LedgerSnapshotDTO, MemberDTO } from "@/lib/types";

const BALANCE_MEMBER_KEY = "bestminton_balance_member";

type Tab = "my" | "group";

interface BalancesPageClientProps {
  initialSnapshot: LedgerSnapshotDTO;
  initialMembers: MemberDTO[];
  dbAvailable: boolean;
  dbError?: string;
}

export default function BalancesPageClient({
  initialSnapshot,
  initialMembers,
  dbAvailable,
  dbError,
}: BalancesPageClientProps) {
  const { t } = useI18n();
  const router = useRouter();
  const { unlocked, pinRequired, unlock } = useAdminPin();
  const [tab, setTab] = useState<Tab>("my");
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [members, setMembers] = useState(initialMembers);
  const [available, setAvailable] = useState(dbAvailable);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(dbError ?? null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [settlingKey, setSettlingKey] = useState<string | null>(null);
  const [pending, setPending] = useState<LedgerEdgeDTO | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(BALANCE_MEMBER_KEY);
      const id = raw ? parseInt(raw, 10) : NaN;
      if (Number.isFinite(id)) setSelectedMemberId(id);
    } catch {
      // localStorage may be unavailable
    }
  }, []);

  useEffect(() => {
    setSnapshot(initialSnapshot);
    setMembers(initialMembers);
    setAvailable(dbAvailable);
    setError(dbError ?? null);
  }, [initialSnapshot, initialMembers, dbAvailable, dbError]);

  const fetchLedger = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [fresh, freshMembers] = await Promise.all([
        dataService.getLedger(),
        dataService.getMembers(),
      ]);
      setSnapshot(fresh);
      setMembers(freshMembers);
      setAvailable(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load balances.");
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshLedger = useCallback(async () => {
    await fetchLedger();
    router.refresh();
  }, [fetchLedger, router]);

  useRegisterPullToRefresh(fetchLedger);

  function selectMember(id: number) {
    setSelectedMemberId(id);
    try {
      localStorage.setItem(BALANCE_MEMBER_KEY, String(id));
    } catch {
      // ignore quota / private mode
    }
  }

  const runPaid = useCallback(
    async (edge: LedgerEdgeDTO) => {
      const key = `${edge.debtorId}:${edge.creditorId}`;
      setSettlingKey(key);
      setError(null);
      setSuccess(null);
      try {
        const beforeRemainder = pairDirectRemainder(
          snapshot.expenses,
          edge.debtorId,
          edge.creditorId
        );
        const next = await dataService.markLedgerPaid(
          edge.debtorId,
          edge.creditorId,
          edge.amount
        );
        setSnapshot(next);
        const remaining = pairDirectRemainder(
          next.expenses,
          edge.debtorId,
          edge.creditorId
        );
        const appliedCents = toCents(beforeRemainder) - toCents(remaining);
        if (appliedCents > 0 && remaining <= 0) {
          setSuccess(t("balances.paidOk"));
        } else if (appliedCents > 0) {
          setSuccess(
            t("balances.paidPartial", {
              remaining: formatCurrency(remaining, next.currency),
            })
          );
        }
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to mark paid.");
      } finally {
        setSettlingKey(null);
        setPending(null);
      }
    },
    [router, snapshot.expenses, t]
  );

  function handlePaid(edge: LedgerEdgeDTO) {
    if (pinRequired && !unlocked) {
      setPending(edge);
      setShowPinModal(true);
      return;
    }
    void runPaid(edge);
  }

  async function handlePinSubmit(pin: string): Promise<string | null> {
    const pinError = await unlock(pin);
    if (pinError) return pinError;
    setShowPinModal(false);
    if (pending) await runPaid(pending);
    return null;
  }

  if (!available) {
    return (
      <div className="mx-auto max-w-lg px-4 py-4 space-y-4">
        <h1 className="tet-page-title inline-flex items-center gap-2">
          <Wallet size={24} className="text-emerald-600 dark:text-amber-400" />
          {t("balances.title")}
        </h1>
        {loading && <PageLoader />}
        <ErrorBanner
          message={error ?? t("balances.dbRequired")}
          onRetry={refreshLedger}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-4 space-y-4">
      <div>
        <h1 className="tet-page-title inline-flex items-center gap-2">
          <Wallet size={24} className="text-emerald-600 dark:text-amber-400" />
          {t("balances.title")}
        </h1>
        {snapshot.bridgeOn && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {t("balances.bridgeOnHint")}
          </p>
        )}
      </div>

      {loading && <PageLoader />}
      {error && <ErrorBanner message={error} onRetry={refreshLedger} />}
      {success && <div className="tet-alert-success text-sm">{success}</div>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab("my")}
          className={tab === "my" ? "tet-tab-active tet-tab" : "tet-tab-inactive tet-tab"}
        >
          {t("balances.myTab")}
        </button>
        <button
          type="button"
          onClick={() => setTab("group")}
          className={tab === "group" ? "tet-tab-active tet-tab" : "tet-tab-inactive tet-tab"}
        >
          {t("balances.groupTab")}
        </button>
      </div>

      {tab === "my" ? (
        <BalanceMeTab
          snapshot={snapshot}
          members={members}
          selectedMemberId={selectedMemberId}
          onSelectMember={selectMember}
          settlingKey={settlingKey}
          onPaid={handlePaid}
        />
      ) : (
        <BalanceGroupTab
          snapshot={snapshot}
          settlingKey={settlingKey}
          onPaid={handlePaid}
        />
      )}

      <AdminPinModal
        open={showPinModal}
        title={t("common.enterPin")}
        onSubmit={handlePinSubmit}
        onCancel={() => {
          setShowPinModal(false);
          setPending(null);
        }}
      />
    </div>
  );
}
