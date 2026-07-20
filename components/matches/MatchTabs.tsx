"use client";

import { useSearchParams } from "next/navigation";
import {
  Suspense,
  useState,
  useEffect,
  useRef,
  useCallback,
  useTransition,
} from "react";
import { Loader2 } from "lucide-react";
import { useRegisterPullToRefresh } from "@/components/PullToRefresh";
import { HomePageSkeleton, MatchCardSkeleton } from "@/components/ui/Skeleton";
import MatchCard from "./MatchCard";
import { useI18n } from "@/contexts/LocaleContext";
import * as dataService from "@/lib/dataService";
import type { MatchDTO } from "@/lib/types";

const PAGE_SIZE = 10;

type Tab = "upcoming" | "past";

interface MatchTabsProps {
  upcoming: MatchDTO[];
  past: MatchDTO[];
  dbAvailable: boolean;
}

function splitMatches(matches: MatchDTO[]): { upcoming: MatchDTO[]; past: MatchDTO[] } {
  const now = new Date();
  return {
    upcoming: matches.filter((m) => new Date(m.scheduledAt) >= now),
    past: matches.filter((m) => new Date(m.scheduledAt) < now).reverse(),
  };
}

function tabFromSearchParams(searchParams: URLSearchParams): Tab {
  return searchParams.get("tab") === "past" ? "past" : "upcoming";
}

function writeTabToUrl(tab: Tab) {
  const url = tab === "past" ? "/?tab=past" : "/";
  // Avoid Next soft-navigation / RSC refetch — tab data is already on the client.
  window.history.replaceState(window.history.state, "", url);
}

function MatchTabsInner({
  upcoming: initialUpcoming,
  past: initialPast,
  dbAvailable,
}: MatchTabsProps) {
  const { t } = useI18n();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<Tab>(() => tabFromSearchParams(searchParams));
  const [upcoming, setUpcoming] = useState<MatchDTO[]>(initialUpcoming);
  const [past, setPast] = useState<MatchDTO[]>(initialPast);
  const [loading, setLoading] = useState(!dbAvailable);
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const [isTabPending, startTabTransition] = useTransition();
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Sync tab from URL (back/forward, shared links) without a full remount flash
  useEffect(() => {
    const fromUrl = tabFromSearchParams(searchParams);
    setActiveTab((prev) => (prev === fromUrl ? prev : fromUrl));
  }, [searchParams]);

  useEffect(() => {
    if (dbAvailable) {
      setUpcoming(initialUpcoming);
      setPast(initialPast);
      setLoading(false);
      return;
    }
    dataService.getMatches().then((matches) => {
      const split = splitMatches(matches);
      setUpcoming(split.upcoming);
      setPast(split.past);
      setLoading(false);
    });
  }, [dbAvailable, initialUpcoming, initialPast]);

  const refreshMatches = useCallback(async () => {
    const matches = await dataService.getMatches();
    const split = splitMatches(matches);
    setUpcoming(split.upcoming);
    setPast(split.past);
  }, []);

  useRegisterPullToRefresh(refreshMatches);

  const allItems = activeTab === "upcoming" ? upcoming : past;
  const list = allItems.slice(0, displayCount);
  const hasMore = displayCount < allItems.length;
  const showListLoading = loading || isTabPending;

  useEffect(() => {
    setDisplayCount(PAGE_SIZE);
  }, [activeTab]);

  const loadMore = useCallback(() => {
    setDisplayCount((prev) => prev + PAGE_SIZE);
  }, []);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || showListLoading) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMore();
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadMore, showListLoading]);

  function switchTab(tab: Tab) {
    if (tab === activeTab) return;
    startTabTransition(() => {
      setActiveTab(tab);
      setDisplayCount(PAGE_SIZE);
    });
    writeTabToUrl(tab);
  }

  return (
    <div>
      <div className="tet-tab-bar" aria-busy={showListLoading}>
        {(["upcoming", "past"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => switchTab(tab)}
            disabled={showListLoading && tab !== activeTab}
            aria-pressed={activeTab === tab}
            className={`tet-tab ${activeTab === tab ? "tet-tab-active" : "tet-tab-inactive"}`}
          >
            {tab === "upcoming"
              ? t("home.tabUpcoming", { count: upcoming.length })
              : t("home.tabPast", { count: past.length })}
          </button>
        ))}
      </div>

      <div className="space-y-3 p-4">
        {showListLoading ? (
          <div className="space-y-3" aria-live="polite" aria-label={t("common.loading")}>
            <MatchCardSkeleton />
            <MatchCardSkeleton />
            <MatchCardSkeleton />
            <div className="flex justify-center py-2">
              <Loader2 size={20} className="animate-spin text-emerald-500 dark:text-amber-400" />
            </div>
          </div>
        ) : list.length === 0 ? (
          <p className="tet-empty py-12">
            {activeTab === "upcoming" ? t("home.noUpcoming") : t("home.noPast")}
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
                {t("home.allLoaded", { count: list.length })}
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
