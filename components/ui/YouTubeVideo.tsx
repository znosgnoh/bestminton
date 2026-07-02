"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Loader2, Play } from "lucide-react";
import ErrorBanner from "@/components/ui/ErrorBanner";
import {
  extractYoutubeStartSeconds,
  extractYoutubeVideoId,
  formatStartTime,
  normalizeYoutubeUrl,
  youtubeEmbedUrl,
  youtubeThumbnailUrl,
} from "@/lib/youtube";

interface YouTubeVideoProps {
  url: string | null;
  title?: string;
}

export function YouTubeVideo({ url, title = "Video trận đấu" }: YouTubeVideoProps) {
  const [playing, setPlaying] = useState(false);

  if (!url) return null;

  const videoId = extractYoutubeVideoId(url);
  if (!videoId) return null;

  const startSeconds = extractYoutubeStartSeconds(url);
  const watchUrl = url;

  return (
    <div className="tet-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
          <Play size={16} className="shrink-0 text-red-600 dark:text-red-400" />
          {title}
          {startSeconds > 0 && (
            <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
              · từ {formatStartTime(startSeconds)}
            </span>
          )}
        </p>
      </div>

      <div className="aspect-video overflow-hidden rounded-xl bg-black/5 dark:bg-black/30">
        {!playing ? (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="group relative h-full w-full"
            aria-label={`Phát video từ ${startSeconds > 0 ? formatStartTime(startSeconds) : "đầu"}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={youtubeThumbnailUrl(videoId)}
              alt=""
              className="h-full w-full object-cover"
            />
            <span className="absolute inset-0 bg-black/25 transition group-hover:bg-black/35" />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition group-hover:scale-105 group-hover:bg-red-500">
                <Play size={28} className="ml-1" fill="currentColor" />
              </span>
            </span>
          </button>
        ) : (
          <iframe
            src={youtubeEmbedUrl(videoId, startSeconds, { autoplay: true })}
            title={title}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        )}
      </div>

      <a
        href={watchUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="tet-btn-ghost flex w-full items-center justify-center gap-2 py-2.5 text-sm"
      >
        <ExternalLink size={16} />
        Mở trên YouTube
        {startSeconds > 0 && (
          <span className="text-gray-500 dark:text-gray-400">({formatStartTime(startSeconds)})</span>
        )}
      </a>
    </div>
  );
}

interface YouTubeUrlEditorProps {
  url: string | null;
  editable: boolean;
  onSave: (url: string | null) => Promise<void>;
}

export function YouTubeUrlEditor({ url, editable, onSave }: YouTubeUrlEditorProps) {
  const [value, setValue] = useState(url ?? "");
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValue(url ?? "");
    setPlaying(false);
  }, [url]);

  if (!editable && !url) return null;

  async function save(nextInput: string) {
    const trimmed = nextInput.trim();
    const next = trimmed ? normalizeYoutubeUrl(trimmed) : null;

    if (trimmed && !next) {
      setError("Link YouTube không hợp lệ.");
      return;
    }

    const current = url?.trim() || null;
    if (next === current) return;

    setLoading(true);
    setError(null);

    try {
      await onSave(next);
      setPlaying(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được link YouTube.");
      setValue(url ?? "");
    } finally {
      setLoading(false);
    }
  }

  function handleBlur() {
    if (!editable || loading) return;
    void save(value);
  }

  if (!editable) {
    return <YouTubeVideo url={url} />;
  }

  const previewId = value.trim() ? extractYoutubeVideoId(value) : null;
  const previewStart = extractYoutubeStartSeconds(value);
  const previewWatchUrl = value.trim() ? normalizeYoutubeUrl(value.trim()) : null;

  return (
    <div className="tet-card p-4 space-y-3">
      <label className="block">
        <span className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
          <Play size={16} className="shrink-0 text-red-600 dark:text-red-400" />
          Link YouTube
          {loading && <Loader2 size={14} className="animate-spin text-gray-400" />}
        </span>
        <input
          type="url"
          inputMode="url"
          value={value}
          disabled={loading}
          onChange={(e) => {
            setValue(e.target.value);
            setPlaying(false);
          }}
          onBlur={handleBlur}
          placeholder="https://youtube.com/watch?v=…&t=1120s"
          className="tet-input mt-2 w-full"
        />
        <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
          Dán link có sẵn thời điểm (<code className="text-xs">t=…</code>) từ YouTube
        </span>
      </label>

      {previewId && (
        <div className="space-y-3">
          <div className="aspect-video overflow-hidden rounded-xl bg-black/5 dark:bg-black/30">
            {!playing ? (
              <button
                type="button"
                onClick={() => setPlaying(true)}
                className="group relative h-full w-full"
                aria-label="Xem thử video"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={youtubeThumbnailUrl(previewId)}
                  alt=""
                  className="h-full w-full object-cover"
                />
                <span className="absolute inset-0 bg-black/25 transition group-hover:bg-black/35" />
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition group-hover:scale-105">
                    <Play size={22} className="ml-0.5" fill="currentColor" />
                  </span>
                </span>
              </button>
            ) : (
              <iframe
                src={youtubeEmbedUrl(previewId, previewStart, { autoplay: true })}
                title="YouTube preview"
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            )}
          </div>

          {previewWatchUrl && (
            <a
              href={previewWatchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="tet-btn-ghost flex w-full items-center justify-center gap-2 py-2 text-sm"
            >
              <ExternalLink size={15} />
              Mở trên YouTube
            </a>
          )}
        </div>
      )}

      {error && <ErrorBanner message={error} onRetry={() => setError(null)} />}
    </div>
  );
}
