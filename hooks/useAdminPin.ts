"use client";

import { useCallback, useEffect, useState } from "react";
import * as dataService from "@/lib/dataService";
import { ADMIN_PIN_KEY, ADMIN_UNLOCK_KEY } from "@/lib/adminPinClient";

export function useAdminPin() {
  const [unlocked, setUnlocked] = useState(false);
  const [pinRequired, setPinRequired] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const stored = sessionStorage.getItem(ADMIN_UNLOCK_KEY) === "true";
    setUnlocked(stored);

    dataService
      .getPinRequired()
      .then((res) => setPinRequired(res.pinRequired))
      .catch(() => setPinRequired(false))
      .finally(() => setChecking(false));
  }, []);

  const getStoredPin = useCallback((): string | undefined => {
    if (typeof window === "undefined") return undefined;
    return sessionStorage.getItem(ADMIN_PIN_KEY) ?? undefined;
  }, []);

  const unlock = useCallback(async (pin: string): Promise<string | null> => {
    try {
      await dataService.verifyAdminPin(pin);
      sessionStorage.setItem(ADMIN_UNLOCK_KEY, "true");
      sessionStorage.setItem(ADMIN_PIN_KEY, pin);
      setUnlocked(true);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Invalid PIN.";
    }
  }, []);

  const clearUnlock = useCallback(() => {
    sessionStorage.removeItem(ADMIN_UNLOCK_KEY);
    sessionStorage.removeItem(ADMIN_PIN_KEY);
    setUnlocked(false);
  }, []);

  return { unlocked, pinRequired, checking, unlock, clearUnlock, getStoredPin };
}
