"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";

type RefreshHandler = () => void | Promise<void>;

interface PullToRefreshContextValue {
  registerOnRefresh: (handler: RefreshHandler) => () => void;
}

const PullToRefreshContext = createContext<PullToRefreshContextValue | null>(null);

/** Optional: client pages with local state can register a data refetch alongside router.refresh(). */
export function useRegisterPullToRefresh(handler: RefreshHandler) {
  const ctx = useContext(PullToRefreshContext);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!ctx) return;
    return ctx.registerOnRefresh(() => handlerRef.current());
  }, [ctx]);
}

interface PullToRefreshProps {
  children: ReactNode;
}

export default function PullToRefresh({ children }: PullToRefreshProps) {
  const router = useRouter();
  const handlersRef = useRef(new Set<RefreshHandler>());

  const registerOnRefresh = useCallback((handler: RefreshHandler) => {
    handlersRef.current.add(handler);
    return () => {
      handlersRef.current.delete(handler);
    };
  }, []);

  const onRefresh = useCallback(async () => {
    const handlers = [...handlersRef.current];
    await Promise.all(handlers.map((fn) => fn()));
    router.refresh();
  }, [router]);

  const { pull, refreshing, reducedMotion, enabled, pullProgress, readyToRelease } =
    usePullToRefresh({ onRefresh });

  const contextValue = useMemo(() => ({ registerOnRefresh }), [registerOnRefresh]);

  const showIndicator = enabled && (pull > 0 || refreshing);
  const label = refreshing
    ? "Refreshing…"
    : readyToRelease
      ? "Release to refresh"
      : "Pull to refresh";

  const contentOffset = reducedMotion ? 0 : pull;
  const indicatorOpacity = refreshing ? 1 : Math.min(1, pullProgress * 1.4);

  return (
    <PullToRefreshContext.Provider value={contextValue}>
      <div className="relative min-h-full">
        <div
          className="ptr-indicator pointer-events-none fixed inset-x-0 z-30 flex justify-center md:hidden"
          style={{
            top: "var(--ptr-header-offset, 5.5rem)",
            opacity: showIndicator ? indicatorOpacity : 0,
            transform: reducedMotion
              ? undefined
              : `translateY(${Math.max(0, pull - 48)}px)`,
          }}
          aria-hidden={!showIndicator}
        >
          <div className="tet-badge-gold flex items-center gap-2 px-3 py-1.5 shadow-sm">
            <Loader2
              size={16}
              className={`text-emerald-600 dark:text-amber-400 ${
                refreshing ? "animate-spin" : "opacity-80"
              }`}
              style={
                !refreshing && !reducedMotion
                  ? { transform: `rotate(${pullProgress * 300}deg)` }
                  : undefined
              }
            />
            <span className="text-xs font-medium">{label}</span>
          </div>
        </div>

        <div
          className="min-h-full"
          style={{
            transform: contentOffset > 0 ? `translateY(${contentOffset}px)` : undefined,
            transition: reducedMotion || pull > 0 || refreshing ? undefined : "transform 200ms ease-out",
          }}
        >
          {children}
        </div>
      </div>
    </PullToRefreshContext.Provider>
  );
}
