"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Film } from "lucide-react";
import VideosList from "@/components/videos/VideosList";
import { useRegisterPullToRefresh } from "@/components/PullToRefresh";
import ErrorBanner from "@/components/ui/ErrorBanner";
import { useI18n } from "@/contexts/LocaleContext";
import type { PlaylistSnapshotDTO } from "@/lib/youtubePlaylist";

interface VideosClientProps {
  playlist: PlaylistSnapshotDTO | null;
  error: string | null;
}

async function fetchPlaylist(): Promise<PlaylistSnapshotDTO> {
  const res = await fetch("/api/videos?refresh=1", { cache: "no-store" });
  const data = (await res.json()) as PlaylistSnapshotDTO & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || "Failed to load videos.");
  }
  return data;
}

export default function VideosClient({ playlist: initial, error: initialError }: VideosClientProps) {
  const { t } = useI18n();
  const [playlist, setPlaylist] = useState(initial);
  const [error, setError] = useState(initialError);

  useEffect(() => {
    setPlaylist(initial);
    setError(initialError);
  }, [initial, initialError]);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchPlaylist();
      setPlaylist(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("videos.loadFailed"));
    }
  }, [t]);

  useRegisterPullToRefresh(refresh);

  return (
    <div className="mx-auto max-w-lg px-4 py-4 space-y-4">
      <div>
        <h1 className="tet-page-title flex items-center gap-2">
          <Film size={22} className="text-red-600 dark:text-red-400" aria-hidden />
          {t("videos.title")}
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">{t("videos.subtitle")}</p>
        {playlist && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-slate-400">
            <span>{t("videos.count", { count: playlist.videos.length })}</span>
            <a
              href={playlist.playlistUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-red-600 hover:underline dark:text-red-400"
            >
              <ExternalLink size={12} aria-hidden />
              {playlist.title || t("videos.openPlaylist")}
            </a>
          </div>
        )}
      </div>

      {error && <ErrorBanner message={error} onRetry={() => void refresh()} />}

      {playlist && <VideosList playlist={playlist} />}
    </div>
  );
}
