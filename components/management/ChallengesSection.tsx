"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Loader2, Swords } from "lucide-react";
import ChallengeManageRow from "./ChallengeManageRow";
import * as dataService from "@/lib/dataService";
import type { ChallengeDTO } from "@/lib/types";

interface ChallengesSectionProps {
  initialChallenges: ChallengeDTO[];
  dbAvailable: boolean;
}

export default function ChallengesSection({
  initialChallenges,
  dbAvailable,
}: ChallengesSectionProps) {
  const [challenges, setChallenges] = useState<ChallengeDTO[]>(initialChallenges);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"completed" | "all">("completed");

  useEffect(() => {
    if (!expanded) return;
    if (dbAvailable && initialChallenges.length > 0 && tab === "completed") return;

    setLoading(true);
    setError(null);
    dataService
      .getChallenges(tab === "completed" ? "COMPLETED" : undefined)
      .then(setChallenges)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load challenges.")
      )
      .finally(() => setLoading(false));
  }, [expanded, tab, dbAvailable, initialChallenges.length]);

  function handleUpdated(updated: ChallengeDTO) {
    setChallenges((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }

  function handleDeleted(id: number) {
    setChallenges((prev) => prev.filter((c) => c.id !== id));
  }

  const list =
    tab === "completed"
      ? challenges.filter((c) => c.status === "COMPLETED")
      : challenges;

  return (
    <section>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="challenges-section-content"
        className="flex w-full cursor-pointer items-center gap-1.5 rounded-lg -ml-1 px-1 py-0.5 text-left transition-colors duration-200 hover:bg-amber-50 dark:hover:bg-gray-800 mb-3"
      >
        <ChevronDown
          size={18}
          className={`shrink-0 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${
            expanded ? "" : "-rotate-90"
          }`}
          aria-hidden
        />
        <h2 className="tet-section-title flex items-center gap-2">
          <Swords size={18} className="text-emerald-600 dark:text-amber-400" />
          Challenge History
        </h2>
      </button>

      <div
        id="challenges-section-content"
        className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
        aria-hidden={!expanded}
      >
        <div className="overflow-hidden">
          {!dbAvailable ? (
            <p className="tet-alert-info text-sm">
              Challenge history requires a database connection.
            </p>
          ) : (
            <>
              <div className="flex gap-2 mb-4">
                {(["completed", "all"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      tab === t
                        ? "bg-emerald-600 text-white dark:bg-amber-500"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                    }`}
                  >
                    {t === "completed" ? "Completed" : "All"}
                  </button>
                ))}
              </div>

              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 size={24} className="animate-spin text-emerald-600" />
                </div>
              ) : error ? (
                <p className="tet-alert-error text-sm">{error}</p>
              ) : list.length === 0 ? (
                <p className="tet-empty">
                  {tab === "completed"
                    ? "No completed challenges yet."
                    : "No challenges yet."}
                </p>
              ) : (
                <div className="space-y-2">
                  {list.map((c) => (
                    <ChallengeManageRow
                      key={c.id}
                      challenge={c}
                      onUpdated={handleUpdated}
                      onDeleted={handleDeleted}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
