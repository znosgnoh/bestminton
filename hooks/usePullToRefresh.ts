"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const PULL_THRESHOLD = 72;
const MAX_PULL = 120;
const RESISTANCE = 0.45;

function getScrollTop(): number {
  return window.scrollY || document.documentElement.scrollTop || 0;
}

function useMediaEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const touchMq = window.matchMedia("(hover: none) and (pointer: coarse)");
    const narrowMq = window.matchMedia("(max-width: 767px)");

    const update = () => setEnabled(touchMq.matches || narrowMq.matches);
    update();

    touchMq.addEventListener("change", update);
    narrowMq.addEventListener("change", update);
    return () => {
      touchMq.removeEventListener("change", update);
      narrowMq.removeEventListener("change", update);
    };
  }, []);

  return enabled;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return reduced;
}

function useStandalonePwa(): boolean {
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(display-mode: standalone)");
    const update = () => {
      const iosStandalone =
        "standalone" in window.navigator &&
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
      setStandalone(mq.matches || iosStandalone);
    };
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return standalone;
}

export interface UsePullToRefreshOptions {
  onRefresh: () => void | Promise<void>;
  enabled?: boolean;
}

export interface UsePullToRefreshResult {
  pull: number;
  refreshing: boolean;
  threshold: number;
  reducedMotion: boolean;
  enabled: boolean;
  pullProgress: number;
  readyToRelease: boolean;
}

export function usePullToRefresh({
  onRefresh,
  enabled: enabledOverride = true,
}: UsePullToRefreshOptions): UsePullToRefreshResult {
  const mediaEnabled = useMediaEnabled();
  const reducedMotion = useReducedMotion();
  const standalone = useStandalonePwa();
  const enabled = enabledOverride && mediaEnabled;

  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const pullRef = useRef(0);
  const startYRef = useRef(0);
  const trackingRef = useRef(false);
  const refreshingRef = useRef(false);

  useEffect(() => {
    refreshingRef.current = refreshing;
  }, [refreshing]);

  useEffect(() => {
    if (!enabled) return;

    const root = document.documentElement;
    root.classList.add("ptr-enabled");
    if (standalone) root.classList.add("ptr-standalone");

    return () => {
      root.classList.remove("ptr-enabled");
      root.classList.remove("ptr-standalone");
    };
  }, [enabled, standalone]);

  const resetPull = useCallback(() => {
    pullRef.current = 0;
    setPull(0);
  }, []);

  const runRefresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    if (!reducedMotion) {
      pullRef.current = PULL_THRESHOLD * 0.65;
      setPull(PULL_THRESHOLD * 0.65);
    }
    try {
      await onRefresh();
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
      resetPull();
    }
  }, [onRefresh, reducedMotion, resetPull]);

  useEffect(() => {
    if (!enabled) return;

    const onTouchStart = (e: TouchEvent) => {
      if (refreshingRef.current || getScrollTop() > 0) {
        trackingRef.current = false;
        return;
      }
      if (e.touches.length !== 1) return;
      startYRef.current = e.touches[0].clientY;
      trackingRef.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!trackingRef.current || refreshingRef.current) return;
      if (getScrollTop() > 0) {
        trackingRef.current = false;
        resetPull();
        return;
      }

      const delta = e.touches[0].clientY - startYRef.current;
      if (delta <= 0) {
        resetPull();
        return;
      }

      const nextPull = Math.min(MAX_PULL, delta * RESISTANCE);
      pullRef.current = nextPull;
      setPull(nextPull);

      if (nextPull > 0) {
        e.preventDefault();
      }
    };

    const onTouchEnd = () => {
      if (!trackingRef.current) return;
      trackingRef.current = false;

      if (pullRef.current >= PULL_THRESHOLD) {
        void runRefresh();
      } else {
        resetPull();
      }
    };

    const onTouchCancel = () => {
      trackingRef.current = false;
      if (!refreshingRef.current) resetPull();
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchCancel, { passive: true });

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [enabled, resetPull, runRefresh]);

  const pullProgress = Math.min(1, pull / PULL_THRESHOLD);

  return {
    pull,
    refreshing,
    threshold: PULL_THRESHOLD,
    reducedMotion,
    enabled,
    pullProgress,
    readyToRelease: pull >= PULL_THRESHOLD,
  };
}
