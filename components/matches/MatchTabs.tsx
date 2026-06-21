"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect, useRef, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { HomePageSkeleton } from "@/components/ui/Skeleton";
import MatchCard from "./MatchCard";
import * as dataService from "@/lib/dataService";
import type { MatchDTO } from "@/lib/types";

const PAGE_SIZE = 10;

interface MatchTabsProps {
  upcoming: MatchDTO[];
  past: MatchDTO[];
  dbAvailable: boolean;
}

function MatchTabsInner({ upcoming: initialUpcoming, past: initialPast, dbAvailable }: MatchTabsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = searchParams.get("tab") === "past" ? "past" : "upcoming";

  const [upcoming, setUpcoming] = useState<MatchDTO[]>(initialUpcoming);
  const [past, setPast] = useState<MatchDTO[]>(initialPast);
  const [loading, setLoading] = useState(!dbAvailable);
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dbAvailable) {
      dataService.getMatches().then((matches) => {
        const now = new Date();
        setUpcoming(matches.filter((m) => new Date(m.scheduledAt) >= now));
        setPast(matches.filter((m) => new Date(m.scheduledAt) < now).reverse());
        setLoading(false);
      });
    }
  }, [dbAvailable]);

  const allItems = activeTab === "upcoming" ? upcoming : past;
  const list = allItems.slice(0, displayCount);
  const hasMore = displayCount < allItems.length;

  useEffect(() => {
    setDisplayCount(PAGE_SIZE);
  }, [activeTab]);

  const loadMore = useCallback(() => {
    setDisplayCount((prev) => prev + PAGE_SIZE);
  }, []);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  function switchTab(tab: string) {
    router.replace(`/?tab=${tab}`, { scroll: false });
  }

  if (loading) {
    return <HomePageSkeleton />;
  }

  return (
    <div>
      <div className="tet-tab-bar">
        {(["upcoming", "past"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => switchTab(tab)}
            className={`tet-tab ${activeTab === tab ? "tet-tab-active" : "tet-tab-inactive"}`}
          >
            {tab === "upcoming" ? `Upcoming (${upcoming.length})` : `Past (${past.length})`}
          </button>
        ))}
      </div>

      <div className="space-y-3 p-4">
        {list.length === 0 ? (
          <p className="tet-empty py-12">
            {activeTab === "upcoming"
              ? "No upcoming matches scheduled."
              : "No past matches yet."}
          </p>
        ) : (
          <>
            {list.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}

            <div ref={sentinelRef} className="h-1" />

            {hasMore && (
              <div className="flex justify-center py-4">
                <Loader2 size={20} className="animate-spin text-emerald-500 dark:text-amber-400" />
              </div>
            )}

            {!hasMore && list.length > PAGE_SIZE && (
              <p className="py-2 text-center text-xs text-gray-500 dark:text-gray-500">
                All {list.length} matches loaded
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function MatchTabs(props: MatchTabsProps) {
  return (
    <Suspense fallback={<HomePageSkeleton />}>
      <MatchTabsInner {...props} />
    </Suspense>
  );
}
