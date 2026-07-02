const VIDEO_ID_PATTERN = /^[\w-]{11}$/;

function parseTimestampToken(token: string): number {
  const trimmed = token.trim();
  if (!trimmed) return 0;
  if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);

  let total = 0;
  const hours = trimmed.match(/(\d+)h/i);
  const minutes = trimmed.match(/(\d+)m/i);
  const seconds = trimmed.match(/(\d+)s/i);
  if (hours) total += parseInt(hours[1], 10) * 3600;
  if (minutes) total += parseInt(minutes[1], 10) * 60;
  if (seconds) total += parseInt(seconds[1], 10);
  return total > 0 ? total : 0;
}

function parseYoutubeUrl(input: string): URL | null {
  try {
    return new URL(input.trim().startsWith("http") ? input.trim() : `https://${input.trim()}`);
  } catch {
    return null;
  }
}

/** Extract an 11-char YouTube video ID from a URL or bare ID string. */
export function extractYoutubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (VIDEO_ID_PATTERN.test(trimmed)) return trimmed;

  const url = parseYoutubeUrl(trimmed);
  if (!url) return null;

  const host = url.hostname.replace(/^www\./, "");

  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0] ?? "";
    return VIDEO_ID_PATTERN.test(id) ? id : null;
  }

  if (host === "youtube.com" || host === "m.youtube.com") {
    const fromQuery = url.searchParams.get("v");
    if (fromQuery && VIDEO_ID_PATTERN.test(fromQuery)) return fromQuery;

    const embed = url.pathname.match(/^\/embed\/([\w-]{11})/);
    if (embed) return embed[1];

    const shorts = url.pathname.match(/^\/shorts\/([\w-]{11})/);
    if (shorts) return shorts[1];
  }

  return null;
}

/** Start time in seconds from `t=` / `start=` query params. */
export function extractYoutubeStartSeconds(input: string): number {
  const trimmed = input.trim();
  if (!trimmed) return 0;

  const url = parseYoutubeUrl(trimmed);
  if (url) {
    const t = url.searchParams.get("t") ?? url.searchParams.get("start");
    if (t) return parseTimestampToken(t);
  }

  return 0;
}

export function buildYoutubeWatchUrl(videoId: string, startSeconds = 0): string {
  const base = `https://www.youtube.com/watch?v=${videoId}`;
  if (startSeconds > 0) return `${base}&t=${startSeconds}s`;
  return base;
}

export function youtubeEmbedUrl(
  videoId: string,
  startSeconds = 0,
  options?: { autoplay?: boolean }
): string {
  const params = new URLSearchParams();
  if (startSeconds > 0) params.set("start", String(startSeconds));
  if (options?.autoplay) params.set("autoplay", "1");
  const qs = params.toString();
  return `https://www.youtube-nocookie.com/embed/${videoId}${qs ? `?${qs}` : ""}`;
}

export function youtubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

export function formatStartTime(seconds: number): string {
  if (seconds <= 0) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function normalizeYoutubeUrl(input: string): string | null {
  const id = extractYoutubeVideoId(input);
  if (!id) return null;
  const start = extractYoutubeStartSeconds(input);
  return buildYoutubeWatchUrl(id, start);
}

export type YoutubeUrlParseResult =
  | { ok: true; url: string | null }
  | { ok: false; error: string };

export function parseYoutubeUrlField(value: unknown): YoutubeUrlParseResult {
  if (value === null || value === undefined) return { ok: true, url: null };
  if (typeof value !== "string") {
    return { ok: false, error: "youtubeUrl must be a string." };
  }

  const trimmed = value.trim();
  if (!trimmed) return { ok: true, url: null };

  const normalized = normalizeYoutubeUrl(trimmed);
  if (!normalized) {
    return { ok: false, error: "Link YouTube không hợp lệ." };
  }

  return { ok: true, url: normalized };
}
