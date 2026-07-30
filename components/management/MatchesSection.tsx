"use client";

import { useState, useEffect, useCallback } from "react";
import { CalendarPlus, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import MatchManageRow from "./MatchManageRow";
import MatchForm from "./MatchForm";
import { useRegisterPullToRefresh } from "@/components/PullToRefresh";
import { useI18n } from "@/contexts/LocaleContext";
import * as dataService from "@/lib/dataService";
import type { MatchDTO } from "@/lib/types";
import type { ShuttlecockBackfillResult } from "@/lib/dataService";

interface MatchesSectionProps {
  initialMatches: MatchDTO[];
  dbAvailable: boolean;
  shuttlecockFeePerHour: number;
}

function sortMatches(all: MatchDTO[]): { upcoming: MatchDTO[]; past: MatchDTO[] } {
  const now = new Date();
  const upcoming = all
    .filter((m) => new Date(m.scheduledAt) >= now)
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  const past = all
    .filter((m) => new Date(m.scheduledAt) < now)
    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
  return { upcoming, past };
}

export default function MatchesSection({
  initialMatches,
  dbAvailable,
  shuttlecockFeePerHour,
}: MatchesSectionProps) {
  const { t } = useI18n();
  const [matches, setMatches] = useState<MatchDTO[]>(initialMatches);
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");
  const [showForm, setShowForm] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<ShuttlecockBackfillResult | null>(null);
  const [backfillError, setBackfillError] = useState<string | null>(null);

  useEffect(() => {
    if (dbAvailable) {
      setMatches(initialMatches);
      return;
    }
    dataService.getMatches().then(setMatches);
  }, [dbAvailable, initialMatches]);

  const refreshMatches = useCallback(async () => {
    const next = await dataService.getMatches();
    setMatches(next);
  }, []);

  useRegisterPullToRefresh(refreshMatches);

  function handleSaved(created: MatchDTO[]) {
    setMatches((prev) => {
      const existing = new Map(prev.map((m) => [m.id, m]));
      for (const m of created) existing.set(m.id, m);
      return Array.from(existing.values());
    });
    setShowForm(false);
  }

  function handleDeleted(id: number) {
    setMatches((prev) => prev.filter((m) => m.id !== id));
  }

  function handleUpdated(m: MatchDTO) {
    setMatches((prev) => prev.map((x) => (x.id === m.id ? m : x)));
  }

  async function handleBackfillShuttlecock() {
    const ok = window.confirm(
      "Create Splitwise shuttlecock remittance expenses for all past matches " +
        "(except Single-title sessions)? Safe to re-run — already remitted matches are skipped."
    );
    if (!ok) return;

    setBackfilling(true);
    setBackfillError(null);
    setBackfillResult(null);
    try {
      const result = await dataService.backfillShuttlecockRemittances({ dryRun: false });
      setBackfillResult(result);
      await refreshMatches();
    } catch (err) {
      setBackfillError(err instanceof Error ? err.message : "Backfill failed.");
    } finally {
      setBackfilling(false);
    }
  }

  const { upcoming, past } = sortMatches(matches);
  const list = activeTab === "upcoming" ? upcoming : past;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="tet-section-title">Matches</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="tet-btn-primary"
        >
          <CalendarPlus size={15} />
          {showForm ? (
            <>
              Cancel <ChevronUp size={13} />
            </>
          ) : (
            <>
              Create <ChevronDown size={13} />
            </>
          )}
        </button>
      </div>

      {showForm && (
        <div className="mb-4 tet-panel">
          <MatchForm onSaved={handleSaved} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {/* Tabs */}
      <div className="tet-tab-bar rounded-t-2xl overflow-hidden mb-0">
        {(["upcoming", "past"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`tet-tab ${activeTab === tab ? "tet-tab-active" : "tet-tab-inactive"}`}
          >
            {tab === "upcoming"
              ? t("home.tabUpcoming", { count: upcoming.length })
              : t("home.tabPast", { count: past.length })}
          </button>
        ))}
      </div>

      {activeTab === "past" && dbAvailable && (
        <div className="border border-t-0 border-amber-200/50 dark:border-amber-900/40 bg-white/70 dark:bg-gray-900/50 px-3 py-2 space-y-2">
          <button
            type="button"
            onClick={handleBackfillShuttlecock}
            disabled={backfilling}
            className="tet-btn-primary w-full text-sm disabled:opacity-60"
          >
            {backfilling && <Loader2 size={14} className="animate-spin" />}
            {backfilling
              ? "Logging shuttlecock remittances…"
              : "Backfill shuttlecock → Tiến Hoàng (past matches)"}
          </button>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            Creates Splitwise records for past sessions (skips Single titles). Description = title +
            date. Rate {shuttlecockFeePerHour}/h.
          </p>
          {backfillError && <p className="tet-alert-error text-xs">{backfillError}</p>}
          {backfillResult && (
            <div className="rounded-lg bg-amber-50/80 dark:bg-gray-800/80 p-2 text-xs text-gray-700 dark:text-gray-300 space-y-1">
              <p>
                Created {backfillResult.summary.created} · Skipped {backfillResult.summary.skipped} ·
                Failed {backfillResult.summary.failed}
              </p>
              {backfillResult.created.slice(0, 8).map((c) => (
                <p key={c.matchId} className="truncate text-gray-500 dark:text-gray-400">
                  #{c.matchId} {c.description} — {c.paidBy} → {c.recipient} ({c.fee})
                </p>
              ))}
              {backfillResult.created.length > 8 && (
                <p>…and {backfillResult.created.length - 8} more</p>
              )}
              {backfillResult.failed.map((f) => (
                <p key={f.matchId} className="text-red-600 dark:text-red-400">
                  #{f.matchId} {f.title}: {f.error}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {list.length === 0 ? (
        <p className="tet-empty rounded-b-2xl border border-t-0 border-solid border-amber-200/50 dark:border-amber-900/40">
          {activeTab === "upcoming" ? t("home.noUpcoming") : t("home.noPast")}
        </p>
      ) : (
        <div className="space-y-2 pt-3">
          {list.map((m) => (
            <MatchManageRow
              key={m.id}
              match={m}
              shuttlecockFeePerHour={shuttlecockFeePerHour}
              onUpdated={handleUpdated}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}
    </section>
  );
}
