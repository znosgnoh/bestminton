"use client";

import { useState } from "react";
import { UserPlus, X, Loader2 } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import * as dataService from "@/lib/dataService";
import type { RegistrationDTO } from "@/lib/types";

interface RegistrationRowProps {
  registration: RegistrationDTO;
  matchId: number;
  isPast: boolean;
  onUpdated: (updated: RegistrationDTO) => void;
}

export default function RegistrationRow({
  registration,
  matchId,
  isPast,
  onUpdated,
}: RegistrationRowProps) {
  const [addingGuest, setAddingGuest] = useState(false);
  const [guestLabel, setGuestLabel] = useState("");
  const [guestPlayedFull, setGuestPlayedFull] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removingGuest, setRemovingGuest] = useState<Set<number>>(new Set());
  const [togglingGuest, setTogglingGuest] = useState<Set<number>>(new Set());
  const [togglingPlaytime, setTogglingPlaytime] = useState(false);
  const [playtimeError, setPlaytimeError] = useState<string | null>(null);
  const [guestError, setGuestError] = useState<string | null>(null);

  async function handleAddGuest() {
    setSaving(true);
    setGuestError(null);
    try {
      const updated = await dataService.addGuest(matchId, registration.memberId, {
        label: guestLabel.trim() || null,
        playedFull: guestPlayedFull,
      });
      onUpdated(updated);
      setGuestLabel("");
      setGuestPlayedFull(true);
      setAddingGuest(false);
    } catch (err) {
      setGuestError(err instanceof Error ? err.message : "Failed to add guest.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveGuest(guestId: number) {
    setRemovingGuest((prev) => new Set(prev).add(guestId));
    try {
      const updated = await dataService.removeGuest(matchId, guestId);
      onUpdated(updated);
    } catch {
      // silently ignore
    } finally {
      setRemovingGuest((prev) => {
        const next = new Set(prev);
        next.delete(guestId);
        return next;
      });
    }
  }

  async function handleToggleGuestPlaytime(guestId: number, playedFull: boolean) {
    setTogglingGuest((prev) => new Set(prev).add(guestId));
    try {
      const updated = await dataService.updateGuest(matchId, guestId, { playedFull });
      onUpdated(updated);
    } catch {
      // silently ignore
    } finally {
      setTogglingGuest((prev) => {
        const next = new Set(prev);
        next.delete(guestId);
        return next;
      });
    }
  }

  async function handleTogglePlaytime() {
    if (togglingPlaytime) return;
    setTogglingPlaytime(true);
    setPlaytimeError(null);
    try {
      const updated = await dataService.updateRegistration(matchId, registration.memberId, {
        playedFull: !(registration.playedFull ?? true),
      });
      onUpdated(updated);
    } catch (err) {
      setPlaytimeError(err instanceof Error ? err.message : "Failed to update.");
    } finally {
      setTogglingPlaytime(false);
    }
  }

  const isFullTime = registration.playedFull ?? true;

  return (
    <div className="flex items-start gap-3 py-3">
      <Avatar name={registration.member.name} avatarUrl={registration.member.avatarUrl} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {registration.member.name}
          </p>

          {/* Member playtime toggle */}
          <button
            type="button"
            onClick={handleTogglePlaytime}
            disabled={togglingPlaytime}
                className={`cursor-pointer flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors duration-200 disabled:cursor-wait disabled:opacity-60 select-none ${
              isFullTime
                ? "tet-pill-full hover:bg-emerald-100 dark:hover:bg-emerald-900"
                : "tet-pill-half hover:bg-amber-100 dark:hover:bg-amber-900"
            }`}
            title="Tap to toggle full / half time"
          >
            {togglingPlaytime && <Loader2 size={10} className="animate-spin" />}
            {isFullTime ? "Full" : "½ time"}
          </button>
        </div>

        {playtimeError && (
          <p className="mt-1 text-xs text-red-500 dark:text-red-400">{playtimeError}</p>
        )}

        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {registration.guests.map((guest) => {
            const guestFull = guest.playedFull ?? true;
            const isRemovingThis = removingGuest.has(guest.id);
            const isTogglingThis = togglingGuest.has(guest.id);
            return (
              <span
                key={guest.id}
                className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 dark:bg-gray-800 pl-2.5 pr-1 py-0.5 text-xs text-gray-700 dark:text-gray-300 ring-1 ring-amber-200/40 dark:ring-gray-700"
              >
                {guest.label || "Guest"}

                {/* Guest playtime toggle */}
                <button
                  type="button"
                  onClick={() => handleToggleGuestPlaytime(guest.id, !guestFull)}
                  disabled={isTogglingThis}
                  className={`cursor-pointer ml-0.5 rounded-full px-1 py-px text-[9px] font-semibold leading-none transition-colors disabled:cursor-wait disabled:opacity-50 ${
                    guestFull
                      ? "bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200"
                      : "bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 hover:bg-amber-200"
                  }`}
                  title="Toggle full / half time"
                >
                  {isTogglingThis ? <Loader2 size={8} className="animate-spin" /> : (guestFull ? "F" : "½")}
                </button>

                {/* Remove button (upcoming only) */}
                {!isPast && (
                  <button
                    type="button"
                    onClick={() => handleRemoveGuest(guest.id)}
                    disabled={isRemovingThis}
                    className="ml-0.5 rounded-full text-gray-400 hover:text-red-500 disabled:opacity-50"
                  >
                    {isRemovingThis ? (
                      <Loader2 size={10} className="animate-spin" />
                    ) : (
                      <X size={10} />
                    )}
                  </button>
                )}
              </span>
            );
          })}

          {!isPast && !addingGuest && (
            <button
              type="button"
              onClick={() => setAddingGuest(true)}
              className="flex cursor-pointer items-center gap-1 rounded-full border border-dashed border-amber-300/70 dark:border-amber-800/50 px-2.5 py-0.5 text-xs text-gray-500 dark:text-gray-400 transition-colors duration-200 hover:border-emerald-400 hover:text-emerald-600 dark:hover:border-amber-500 dark:hover:text-amber-400"
            >
              <UserPlus size={10} />
              + Guest
            </button>
          )}

          {!isPast && addingGuest && (
            <div className="mt-1 w-full rounded-xl border border-amber-200/60 dark:border-gray-700 bg-amber-50/50 dark:bg-gray-800/60 p-2.5 flex flex-col gap-2">
              <input
                autoFocus
                type="text"
                placeholder="Name (optional)"
                value={guestLabel}
                onChange={(e) => setGuestLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddGuest();
                  if (e.key === "Escape") {
                    setAddingGuest(false);
                    setGuestLabel("");
                    setGuestPlayedFull(true);
                  }
                }}
                className="tet-input rounded-lg px-2.5 py-1 text-xs focus:ring-1"
              />

              {/* Playtime toggle */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-gray-500 dark:text-gray-400 mr-0.5">Playtime:</span>
                <button
                  type="button"
                  onClick={() => setGuestPlayedFull(true)}
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition-colors ${
                    guestPlayedFull
                      ? "bg-emerald-500 text-white"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600"
                  }`}
                >
                  Full
                </button>
                <button
                  type="button"
                  onClick={() => setGuestPlayedFull(false)}
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition-colors ${
                    !guestPlayedFull
                      ? "bg-amber-500 text-white"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600"
                  }`}
                >
                  ½ time
                </button>
              </div>

              {guestError && (
                <p className="text-[10px] text-red-500 dark:text-red-400">{guestError}</p>
              )}

              <div className="flex items-center gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={handleAddGuest}
                  disabled={saving}
                  className="tet-btn-primary flex-1 rounded-lg px-2 py-1 text-xs"
                >
                  {saving ? <Loader2 size={10} className="animate-spin" /> : "Add Guest"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddingGuest(false);
                    setGuestLabel("");
                    setGuestPlayedFull(true);
                  }}
                  className="tet-btn-ghost rounded-lg px-2 py-1 text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {registration.guests.length > 0 && (
        <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500 mt-1">
          +{registration.guests.length}
        </span>
      )}
    </div>
  );
}
