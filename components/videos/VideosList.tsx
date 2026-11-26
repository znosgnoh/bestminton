"use client";

import { ExternalLink } from "lucide-react";
import VideoCard from "@/components/videos/VideoCard";
import { useI18n } from "@/contexts/LocaleContext";
import type { PlaylistSnapshotDTO } from "@/lib/youtubePlaylist";

interface VideosListProps {
  playlist: PlaylistSnapshotDTO;
}

export default function VideosList({ playlist }: VideosListProps) {
  const { t } = useI18n();

  if (playlist.videos.length === 0) {
    return (
      <div className="tet-card p-5 text-center">
        <p className="text-sm text-gray-600 dark:text-slate-400">{t("videos.empty")}</p>
        <a
          href={playlist.playlistUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="tet-btn-ghost mt-3 inline-flex items-center gap-1.5 text-sm"
        >
          <ExternalLink size={14} aria-hidden />
          {t("videos.openPlaylist")}
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {playlist.videos.map((video) => (
        <VideoCard key={video.id} video={video} />
      ))}
    </div>
  );
}
