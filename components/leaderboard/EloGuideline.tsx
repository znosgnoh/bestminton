"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, TrendingDown, TrendingUp } from "lucide-react";
import { useI18n } from "@/contexts/LocaleContext";
import {
  ELO_GUIDELINE_ANCHOR,
  ELO_GUIDELINE_EXAMPLES,
  ELO_GUIDELINE_FACTS,
  ELO_WIN_PROB_DEMO,
  demoExpectedWithHandicap,
  demoExpectedWithoutHandicap,
  formatWinPct,
} from "@/lib/eloGuideline";

function WinBar({ label, pct, accent }: { label: string; pct: number; accent: "a" | "b" }) {
  const width = Math.round(pct * 100);
  const barCls =
    accent === "a"
      ? "bg-emerald-500 dark:bg-amber-500"
      : "bg-amber-400 dark:bg-amber-600";

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="font-medium text-gray-700 dark:text-gray-300">{label}</span>
        <span className="text-gray-500 dark:text-gray-400">{formatWinPct(pct)}</span>
      </div>
      <div className="h-2.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barCls}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function FlowStep({
  step,
  title,
  body,
}: {
  step: number;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950 text-xs font-bold text-emerald-700 dark:text-emerald-300">
        {step}
      </span>
      <div className="min-w-0 pt-0.5">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</p>
        <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

export default function EloGuideline() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const facts = ELO_GUIDELINE_FACTS;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === `#${ELO_GUIDELINE_ANCHOR}`) {
      setOpen(true);
      requestAnimationFrame(() => {
        document.getElementById(ELO_GUIDELINE_ANCHOR)?.scrollIntoView({ behavior: "smooth" });
      });
    }
  }, []);

  const demo = ELO_WIN_PROB_DEMO;
  const baseExpectedA = demoExpectedWithoutHandicap(demo.ratingA, demo.ratingB);
  const handicappedExpectedA = demoExpectedWithHandicap(
    demo.ratingA,
    demo.ratingB,
    demo.handicap,
    demo.recipient
  );

  return (
    <section id={ELO_GUIDELINE_ANCHOR} className="scroll-mt-28">
      <div className="tet-card overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left cursor-pointer hover:bg-amber-50/50 dark:hover:bg-gray-800/40 transition-colors"
          aria-expanded={open}
        >
          <div>
            <h2 className="tet-section-title text-sm">{t("leaderboard.eloGuideTitle")}</h2>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {t("leaderboard.eloGuideSubtitle")}
            </p>
          </div>
          {open ? (
            <ChevronUp size={18} className="shrink-0 text-gray-400" />
          ) : (
            <ChevronDown size={18} className="shrink-0 text-gray-400" />
          )}
        </button>

        {open && (
          <div className="border-t border-amber-100/60 dark:border-gray-800 px-4 py-4 space-y-5">
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              {t("eloGuide.intro", { defaultElo: facts.defaultElo })}
            </p>

            <div className="rounded-xl border border-amber-200/50 dark:border-gray-800 bg-amber-50/40 dark:bg-gray-900/50 p-4 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {t("eloGuide.formula")}
              </p>
              <div className="rounded-lg bg-white/80 dark:bg-gray-950/60 px-3 py-2.5 text-center font-mono text-xs text-gray-800 dark:text-gray-200 ring-1 ring-amber-200/40 dark:ring-gray-700">
                {t("eloGuide.formulaExpr")}
              </div>
              <div className="space-y-3">
                <FlowStep
                  step={1}
                  title={t("eloGuide.stepKTitle")}
                  body={t("eloGuide.stepKBody", {
                    kNew: facts.kNew,
                    threshold: facts.kThreshold,
                    kEstablished: facts.kEstablished,
                  })}
                />
                <FlowStep
                  step={2}
                  title={t("eloGuide.stepExpectTitle")}
                  body={t("eloGuide.stepExpectBody", { eloPerPoint: facts.eloPerHandicapPoint })}
                />
                <FlowStep step={3} title={t("eloGuide.stepScoreTitle")} body={t("eloGuide.stepScoreBody")} />
                <FlowStep step={4} title={t("eloGuide.stepGapTitle")} body={t("eloGuide.stepGapBody")} />
                <FlowStep
                  step={5}
                  title={t("eloGuide.stepStreakTitle")}
                  body={t("eloGuide.stepStreakBody")}
                />
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {t("eloGuide.winProbTitle", {
                  a: demo.ratingA,
                  b: demo.ratingB,
                  handicap: demo.handicap,
                  side: demo.recipient,
                })}
              </p>
              <div className="rounded-xl border border-amber-200/50 dark:border-gray-800 p-4 space-y-4">
                <div>
                  <p className="text-[10px] font-medium uppercase text-gray-400 mb-2">
                    {t("eloGuide.noHandicap")}
                  </p>
                  <WinBar label={`Side A (${demo.ratingA})`} pct={baseExpectedA} accent="a" />
                  <div className="mt-2">
                    <WinBar label={`Side B (${demo.ratingB})`} pct={1 - baseExpectedA} accent="b" />
                  </div>
                </div>
                <div className="border-t border-amber-100/60 dark:border-gray-800 pt-4">
                  <p className="text-[10px] font-medium uppercase text-gray-400 mb-2">
                    {t("eloGuide.withHandicap", { handicap: demo.handicap, side: demo.recipient })}
                  </p>
                  <WinBar label="Side A" pct={handicappedExpectedA} accent="a" />
                  <div className="mt-2">
                    <WinBar label="Side B" pct={1 - handicappedExpectedA} accent="b" />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {t("eloGuide.examplesTitle", { k: facts.kEstablished, threshold: facts.kThreshold })}
              </p>
              <div className="overflow-x-auto rounded-xl border border-amber-200/50 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-amber-100/80 dark:border-gray-800 bg-amber-50/70 dark:bg-gray-800/70 text-left text-gray-500 dark:text-gray-400">
                      <th className="px-3 py-2 font-semibold">{t("eloGuide.colScenario")}</th>
                      <th className="px-3 py-2 font-semibold">{t("eloGuide.colScore")}</th>
                      <th className="px-3 py-2 font-semibold text-center">{t("eloGuide.colHandicap")}</th>
                      <th className="px-3 py-2 font-semibold text-right">{t("eloGuide.colWin")}</th>
                      <th className="px-3 py-2 font-semibold text-right">{t("eloGuide.colLoss")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100/60 dark:divide-gray-800">
                    {ELO_GUIDELINE_EXAMPLES.map((ex) => (
                      <tr
                        key={ex.id}
                        className="bg-transparent hover:bg-amber-50/50 dark:hover:bg-gray-800/50 transition-colors"
                      >
                        <td className="px-3 py-2.5">
                          <p className="font-medium text-gray-900 dark:text-gray-100">
                            {t(`eloGuide.${ex.labelKey}`)}
                          </p>
                          <p className="text-[10px] text-gray-500">{ex.matchup}</p>
                        </td>
                        <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400 font-mono">{ex.score}</td>
                        <td className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-400">
                          {ex.handicap > 0 ? ex.handicap : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold text-emerald-700 dark:text-amber-400">
                          <span className="inline-flex items-center justify-end gap-0.5">
                            <TrendingUp size={12} />
                            +{ex.winnerDelta}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold text-red-600 dark:text-red-400">
                          <span className="inline-flex items-center justify-end gap-0.5">
                            <TrendingDown size={12} />
                            {ex.loserDelta}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-[11px] text-gray-500 dark:text-gray-500 leading-relaxed">{t("eloGuide.scoreHint")}</p>
          </div>
        )}
      </div>
    </section>
  );
}
