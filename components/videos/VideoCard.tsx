"use client";

import { useState } from "react";
import { ExternalLink, Play } from "lucide-react";
import { youtubeEmbedUrl } from "@/lib/youtube";
import type { PlaylistVideoDTO } from "@/lib/youtubePlaylist";
import { useI18n } from "@/contexts/LocaleContext";

interface VideoCardProps {
  video: PlaylistVideoDTO;
}

export default function VideoCard({ video }: VideoCardProps) {
  const { t } = useI18n();
  const [playing, setPlaying] = useState(false);

  return (
    <article className="tet-card overflow-hidden">
      <div className="aspect-video bg-black/5 dark:bg-black/40">
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
            <span className="absolute inset-0 bg-black/25 transition group-hover:bg-black/35" />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition group-hover:scale-105 group-hover:bg-red-500">
                <Play size={22} className="ml-0.5" fill="currentColor" aria-hidden />
              </span>
            </span>
            {video.durationLabel && (
              <span className="absolute bottom-2 right-2 rounded-md bg-black/75 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white">
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
      </div>

      <div className="space-y-2 p-3.5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="min-w-0 flex-1 text-sm font-semibold leading-snug text-gray-900 dark:text-gray-100">
            {video.title}
          </h2>
          <span className="shrink-0 text-[11px] tabular-nums text-gray-400 dark:text-slate-500">
            #{video.position}
          </span>
        </div>
        {video.uploadedLabel && (
          <p className="text-xs text-gray-500 dark:text-slate-400">{video.uploadedLabel}</p>
        )}
        <a
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className="tet-btn-ghost inline-flex items-center gap-1.5 px-0 py-1 text-xs"
        >
          <ExternalLink size={13} aria-hidden />
          {t("videos.openOnYoutube")}
        </a>
      </div>
    </article>
  );
}
