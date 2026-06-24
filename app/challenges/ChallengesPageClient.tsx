"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import ChallengeCard from "@/components/challenges/ChallengeCard";
import ErrorBanner from "@/components/ui/ErrorBanner";
import PageLoader from "@/components/ui/PageLoader";
import type { ChallengeDTO } from "@/lib/types";

type FilterStatus = "ALL" | "PENDING" | "ACTIVE" | "COMPLETED";

interface ChallengesPageClientProps {
  initialChallenges: ChallengeDTO[];
  dbAvailable: boolean;
}

export default function ChallengesPageClient({
  initialChallenges,
  dbAvailable,
}: ChallengesPageClientProps) {
  const [challenges] = useState(initialChallenges);
  const [filter, setFilter] = useState<FilterStatus>("ALL");

  if (!dbAvailable) {
    return (
      <div className="mx-auto max-w-lg px-4 py-4 space-y-4">
        <h1 className="tet-page-title">Challenges</h1>
        <ErrorBanner message="Challenges require a live database connection." />
      </div>
    );
  }

  const filtered =
    filter === "ALL" ? challenges : challenges.filter((c) => c.status === filter);

  return (
    <div className="mx-auto max-w-lg px-4 py-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="tet-page-title">Challenges</h1>
        <Link href="/challenges/new" className="tet-btn-primary flex items-center gap-1.5 px-4 py-2 text-sm">
          <Plus size={16} />
          New
        </Link>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {(["ALL", "PENDING", "ACTIVE", "COMPLETED"] as FilterStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={filter === s ? "tet-tab-active tet-tab shrink-0" : "tet-tab-inactive tet-tab shrink-0"}
          >
            {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="tet-empty">
          <p>No challenges yet.</p>
          <Link href="/challenges/new" className="tet-link-accent mt-2 inline-block">
            Create the first challenge
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <ChallengeCard key={c.id} challenge={c} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ChallengesLoading() {
  return <PageLoader label="Loading challenges…" />;
}
