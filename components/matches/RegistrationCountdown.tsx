"use client";

import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { useI18n } from "@/contexts/LocaleContext";
import { formatLocal } from "@/lib/datetime";

interface RegistrationCountdownProps {
  closesAt: string;
  /** Bumps when the deadline crosses so parents can lock registration. */
  onClosedChange?: (closed: boolean) => void;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function remainingParts(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return { days, hours, minutes, seconds, totalSec };
}

export default function RegistrationCountdown({
  closesAt,
  onClosedChange,
}: RegistrationCountdownProps) {
  const { t, locale } = useI18n();
  const closesMs = new Date(closesAt).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const closed = now >= closesMs;
  useEffect(() => {
    onClosedChange?.(closed);
  }, [closed, onClosedChange]);

  const deadlineLabel = formatLocal(closesAt, locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  if (closed) {
    return (
      <div className="tet-alert-error flex items-start gap-2.5 px-3 py-2.5">
        <Timer size={16} className="mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium">{t("matches.registrationClosed")}</p>
          <p className="text-xs opacity-80 mt-0.5">
            {t("matches.registrationClosedAt", { time: deadlineLabel })}
          </p>
        </div>
      </div>
    );
  }

  const { days, hours, minutes, seconds } = remainingParts(closesMs - now);
  const clock =
    days > 0
      ? t("matches.countdownDhms", {
          days: String(days),
          hours: pad(hours),
          minutes: pad(minutes),
          seconds: pad(seconds),
        })
      : t("matches.countdownHms", {
          hours: pad(hours),
          minutes: pad(minutes),
          seconds: pad(seconds),
        });

  return (
    <div className="tet-alert-info flex items-start gap-2.5 px-3 py-2.5">
      <Timer size={16} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {t("matches.registrationClosesIn")}
        </p>
        <p className="font-mono text-lg font-semibold tracking-tight text-emerald-700 dark:text-emerald-300 tabular-nums mt-0.5">
          {clock}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {t("matches.registrationClosesAt", { time: deadlineLabel })}
        </p>
      </div>
    </div>
  );
}
