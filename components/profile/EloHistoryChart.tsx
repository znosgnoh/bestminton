"use client";

import { DEFAULT_ELO } from "@/lib/elo";
import { useI18n } from "@/contexts/LocaleContext";
import type { EloHistoryPointDTO } from "@/lib/types";

interface EloHistoryChartProps {
  history: EloHistoryPointDTO[];
  currentElo: number;
}

const WIDTH = 360;
const HEIGHT = 160;
const PAD_X = 28;
const PAD_Y = 20;

export default function EloHistoryChart({ history, currentElo }: EloHistoryChartProps) {
  const { t } = useI18n();

  if (history.length === 0) {
    return (
      <div className="tet-empty py-8">
        <p>{t("profile.noEloHistory")}</p>
      </div>
    );
  }

  const points = [
    {
      xLabel: t("profile.eloStart"),
      elo: history[0]?.before ?? DEFAULT_ELO,
      delta: 0,
      won: null as boolean | null,
    },
    ...history.map((h) => ({
      xLabel: "",
      elo: h.after,
      delta: h.delta,
      won: h.won as boolean | null,
    })),
  ];

  const elos = points.map((p) => p.elo);
  const minElo = Math.min(...elos, currentElo) - 20;
  const maxElo = Math.max(...elos, currentElo) + 20;
  const range = Math.max(maxElo - minElo, 1);

  const coords = points.map((p, i) => {
    const x =
      points.length === 1
        ? WIDTH / 2
        : PAD_X + (i / (points.length - 1)) * (WIDTH - PAD_X * 2);
    const y = PAD_Y + (1 - (p.elo - minElo) / range) * (HEIGHT - PAD_Y * 2);
    return { ...p, x, y };
  });

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
  const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${HEIGHT - PAD_Y} L ${coords[0].x} ${HEIGHT - PAD_Y} Z`;

  const latest = history[history.length - 1];
  const netDelta = latest ? latest.after - (history[0]?.before ?? DEFAULT_ELO) : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {t("profile.currentElo")}
          </p>
          <p className="text-2xl font-bold text-emerald-700 dark:text-amber-400">{currentElo}</p>
        </div>
        <p
          className={`text-sm font-semibold ${
            netDelta > 0
              ? "text-green-600 dark:text-green-400"
              : netDelta < 0
                ? "text-red-600 dark:text-red-400"
                : "text-gray-500 dark:text-gray-400"
          }`}
        >
          {netDelta > 0 ? "+" : ""}
          {netDelta} {t("profile.sinceStart")}
        </p>
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full overflow-visible"
        role="img"
        aria-label={t("profile.eloChartAria")}
      >
        <defs>
          <linearGradient id="eloArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(16 185 129)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="rgb(16 185 129)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Guide lines */}
        {[0.25, 0.5, 0.75].map((frac) => {
          const y = PAD_Y + frac * (HEIGHT - PAD_Y * 2);
          return (
            <line
              key={frac}
              x1={PAD_X}
              y1={y}
              x2={WIDTH - PAD_X}
              y2={y}
              className="stroke-amber-100 dark:stroke-gray-800"
              strokeWidth={1}
            />
          );
        })}

        <path d={areaPath} fill="url(#eloArea)" />
        <path
          d={linePath}
          fill="none"
          className="stroke-emerald-600 dark:stroke-amber-400"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {coords.map((c, i) => (
          <g key={i}>
            <circle
              cx={c.x}
              cy={c.y}
              r={i === 0 ? 3.5 : 4.5}
              className={
                c.won === true
                  ? "fill-green-500 dark:fill-green-400"
                  : c.won === false
                    ? "fill-red-500 dark:fill-red-400"
                    : "fill-emerald-700 dark:fill-amber-400"
              }
            />
            {i === coords.length - 1 && (
              <text
                x={c.x}
                y={c.y - 10}
                textAnchor="middle"
                className="fill-emerald-800 dark:fill-amber-300 text-[10px] font-semibold"
              >
                {c.elo}
              </text>
            )}
          </g>
        ))}

        <text
          x={PAD_X}
          y={PAD_Y - 6}
          className="fill-gray-400 dark:fill-gray-500 text-[9px]"
        >
          {Math.round(maxElo)}
        </text>
        <text
          x={PAD_X}
          y={HEIGHT - PAD_Y + 12}
          className="fill-gray-400 dark:fill-gray-500 text-[9px]"
        >
          {Math.round(minElo)}
        </text>
      </svg>

      <div className="flex flex-wrap gap-1.5">
        {history
          .slice(-8)
          .reverse()
          .map((h) => (
            <span
              key={h.challengeId}
              className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                h.won
                  ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                  : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
              }`}
              title={`${h.opponentNames.join(" & ")} · ${h.delta > 0 ? "+" : ""}${h.delta}`}
            >
              {h.won ? "W" : "L"} {h.delta > 0 ? "+" : ""}
              {h.delta}
            </span>
          ))}
      </div>
    </div>
  );
}
