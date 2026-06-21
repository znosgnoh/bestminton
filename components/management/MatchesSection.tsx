"use client";

import { useState, useEffect } from "react";
import { CalendarPlus, ChevronDown, ChevronUp } from "lucide-react";
import MatchManageRow from "./MatchManageRow";
import MatchForm from "./MatchForm";
import * as dataService from "@/lib/dataService";
import type { MatchDTO } from "@/lib/types";

interface MatchesSectionProps {
  initialMatches: MatchDTO[];
  dbAvailable: boolean;
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

export default function MatchesSection({ initialMatches, dbAvailable }: MatchesSectionProps) {
  const [matches, setMatches] = useState<MatchDTO[]>(initialMatches);
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!dbAvailable) {
      dataService.getMatches().then(setMatches);
    }
  }, [dbAvailable]);

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
            {tab === "upcoming" ? `Upcoming (${upcoming.length})` : `Past (${past.length})`}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="tet-empty rounded-b-2xl border border-t-0 border-solid border-amber-200/50 dark:border-amber-900/40">
          {activeTab === "upcoming" ? "No upcoming matches." : "No past matches yet."}
        </p>
      ) : (
        <div className="space-y-2 pt-3">
          {list.map((m) => (
            <MatchManageRow
              key={m.id}
              match={m}
              onUpdated={handleUpdated}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}
    </section>
  );
}
