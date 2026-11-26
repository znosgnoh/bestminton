"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { youtubeEmbedUrl } from "@/lib/youtube";
import type { PlaylistVideoDTO } from "@/lib/youtubePlaylist";
import { useI18n } from "@/contexts/LocaleContext";

interface VideoCardProps {
  video: PlaylistVideoDTO;
}

function YoutubeMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={className}
      fill="currentColor"
    >
      <path d="M23.5 6.2a3.1 3.1 0 0 0-2.2-2.2C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.3.5A3.1 3.1 0 0 0 .5 6.2 32.4 32.4 0 0 0 0 12a32.4 32.4 0 0 0 .5 5.8 3.1 3.1 0 0 0 2.2 2.2c1.8.5 9.3.5 9.3.5s7.5 0 9.3-.5a3.1 3.1 0 0 0 2.2-2.2A32.4 32.4 0 0 0 24 12a32.4 32.4 0 0 0-.5-5.8ZM9.8 15.5v-7l6.2 3.5-6.2 3.5Z" />
    </svg>
  );
}

export default function VideoCard({ video }: VideoCardProps) {
  const { t } = useI18n();
  const [playing, setPlaying] = useState(false);

  const metaParts = [video.uploadedLabel, video.durationLabel].filter(Boolean);

  return (
    <article className="tet-card overflow-hidden">
      <div className="relative aspect-video bg-slate-950/5 dark:bg-black/40">
        {!playing ? (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="group relative h-full w-full"
            aria-label={t("videos.play", { title: video.title })}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={video.thumbnailUrl}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
            <span className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-black/10 transition group-hover:from-black/65" />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/95 text-slate-950 shadow-lg ring-1 ring-black/5 transition group-hover:scale-105 dark:bg-white">
                <Play size={20} className="ml-0.5" fill="currentColor" aria-hidden />
              </span>
            </span>
            {video.durationLabel && (
              <span className="absolute bottom-2.5 right-2.5 rounded-md bg-black/80 px-1.5 py-0.5 text-[11px] font-medium tabular-nums tracking-wide text-white">
                {video.durationLabel}
              </span>
            )}
          </button>
        ) : (
          <iframe
            src={youtubeEmbedUrl(video.id, 0, { autoplay: true })}
            title={video.title}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        )}

        <a
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute right-2.5 top-2.5 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white/90 backdrop-blur-sm transition hover:bg-red-600 hover:text-white"
          aria-label={t("videos.openOnYoutube")}
          title={t("videos.openOnYoutube")}
          onClick={(e) => e.stopPropagation()}
        >
          <YoutubeMark className="h-4 w-4" />
        </a>
      </div>

      <div className="flex items-start gap-3 px-3.5 py-3">
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="text-sm font-semibold leading-snug text-gray-900 dark:text-gray-100">
            {video.title}
          </h2>
          {metaParts.length > 0 && (
            <p className="text-xs text-gray-500 dark:text-slate-400">
              {metaParts.join(" · ")}
            </p>
          )}
        </div>
        <span className="mt-0.5 shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          #{video.position}
        </span>
      </div>
    </article>
  );
}
