import { buildYoutubeWatchUrl, youtubeThumbnailUrl } from "@/lib/youtube";

/** Team session recordings playlist (Cọc cạch cờ lắp). */
export const DEFAULT_SESSION_PLAYLIST_ID = "PLcuS_id41Tj5-NF8TSkoKwanli-VHIq3W";

/** Public playlist URL for “open on YouTube”. */
export function sessionPlaylistUrl(playlistId = getSessionPlaylistId()): string {
  return `https://www.youtube.com/playlist?list=${playlistId}`;
}

export function getSessionPlaylistId(): string {
  const fromEnv = process.env.YOUTUBE_PLAYLIST_ID?.trim();
  return fromEnv || DEFAULT_SESSION_PLAYLIST_ID;
}

export interface PlaylistVideoDTO {
  id: string;
  title: string;
  url: string;
  thumbnailUrl: string;
  durationSeconds: number | null;
  durationLabel: string | null;
  position: number;
  /** Relative upload age from YouTube when available (e.g. "20h ago"). */
  uploadedLabel: string | null;
}

export interface PlaylistSnapshotDTO {
  id: string;
  title: string;
  videoCount: number;
  playlistUrl: string;
  videos: PlaylistVideoDTO[];
  source: "api" | "web";
  fetchedAt: string;
}

const VIDEO_ID_RE = /^[\w-]{11}$/;
const YT_WEB_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** Parse `HH:MM:SS` / `MM:SS` / `SS` labels from YouTube UI. */
export function parseYoutubeDurationLabel(label: string): number | null {
  const trimmed = label.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(":").map((p) => Number(p));
  if (parts.length === 0 || parts.some((n) => !Number.isFinite(n) || n < 0)) return null;
  if (parts.length === 3) return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  if (parts.length === 2) return parts[0]! * 60 + parts[1]!;
  if (parts.length === 1) return parts[0]!;
  return null;
}

/** ISO-8601 duration from YouTube Data API (`PT1H2M3S`). */
export function parseIso8601Duration(value: string): number | null {
  const m = value.trim().match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (!m) return null;
  const hours = m[1] ? parseInt(m[1], 10) : 0;
  const minutes = m[2] ? parseInt(m[2], 10) : 0;
  const seconds = m[3] ? parseInt(m[3], 10) : 0;
  return hours * 3600 + minutes * 60 + seconds;
}

export function formatDurationSeconds(total: number): string {
  if (!Number.isFinite(total) || total < 0) return "";
  const s = Math.floor(total);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function runsText(node: unknown): string | null {
  if (!node || typeof node !== "object") return null;
  const obj = node as { simpleText?: string; runs?: Array<{ text?: string }> };
  if (typeof obj.simpleText === "string" && obj.simpleText.trim()) return obj.simpleText.trim();
  if (Array.isArray(obj.runs)) {
    const text = obj.runs.map((r) => r?.text ?? "").join("").trim();
    return text || null;
  }
  return null;
}

function walkFind<T>(root: unknown, pick: (node: Record<string, unknown>) => T | null): T[] {
  const out: T[] = [];
  const stack: unknown[] = [root];
  while (stack.length) {
    const cur = stack.pop();
    if (!cur) continue;
    if (Array.isArray(cur)) {
      for (const item of cur) stack.push(item);
      continue;
    }
    if (typeof cur !== "object") continue;
    const obj = cur as Record<string, unknown>;
    const hit = pick(obj);
    if (hit !== null) out.push(hit);
    for (const value of Object.values(obj)) {
      if (value && (typeof value === "object" || Array.isArray(value))) stack.push(value);
    }
  }
  return out;
}

function extractContinuationTokens(root: unknown): string[] {
  const tokens = walkFind(root, (obj) => {
    const cmd = obj.continuationCommand;
    if (cmd && typeof cmd === "object") {
      const token = (cmd as { token?: string }).token;
      return typeof token === "string" && token ? token : null;
    }
    return null;
  });
  return [...new Set(tokens)];
}

function extractPlaylistTitle(root: unknown): string | null {
  const titles = walkFind(root, (obj) => {
    const sidebar = obj.playlistSidebarPrimaryInfoRenderer;
    if (!sidebar || typeof sidebar !== "object") return null;
    return runsText((sidebar as { title?: unknown }).title);
  });
  return titles[0] ?? null;
}

function extractVideoCount(root: unknown): number | null {
  const counts = walkFind(root, (obj) => {
    const sidebar = obj.playlistSidebarPrimaryInfoRenderer;
    if (!sidebar || typeof sidebar !== "object") return null;
    const stats = (sidebar as { stats?: unknown[] }).stats;
    if (!Array.isArray(stats)) return null;
    for (const stat of stats) {
      const text = runsText(stat);
      if (!text) continue;
      const m = text.match(/([\d,]+)\s*videos?/i);
      if (m) return parseInt(m[1]!.replace(/,/g, ""), 10);
    }
    return null;
  });
  return counts[0] ?? null;
}

function parsePlaylistVideoRenderer(
  renderer: Record<string, unknown>,
  fallbackPosition: number
): PlaylistVideoDTO | null {
  const id = typeof renderer.videoId === "string" ? renderer.videoId : null;
  if (!id || !VIDEO_ID_RE.test(id)) return null;

  const title = runsText(renderer.title) ?? id;
  const lengthLabel =
    runsText(renderer.lengthText) ??
    (() => {
      const overlays = renderer.thumbnailOverlays;
      if (!Array.isArray(overlays)) return null;
      for (const overlay of overlays) {
        if (!overlay || typeof overlay !== "object") continue;
        const time = (overlay as { thumbnailOverlayTimeStatusRenderer?: { text?: unknown } })
          .thumbnailOverlayTimeStatusRenderer;
        const label = runsText(time?.text);
        if (label) return label;
      }
      return null;
    })();

  let durationSeconds: number | null = null;
  if (typeof renderer.lengthSeconds === "string" || typeof renderer.lengthSeconds === "number") {
    const n = Number(renderer.lengthSeconds);
    if (Number.isFinite(n) && n >= 0) durationSeconds = Math.floor(n);
  }
  if (durationSeconds === null && lengthLabel) {
    durationSeconds = parseYoutubeDurationLabel(lengthLabel);
  }

  const indexLabel = runsText(renderer.index);
  const position = indexLabel ? parseInt(indexLabel, 10) : fallbackPosition;
  const uploadedLabel = (() => {
    const info = runsText(renderer.videoInfo);
    if (!info) return null;
    const parts = info.split("•").map((p) => p.trim()).filter(Boolean);
    return parts.length >= 2 ? parts[parts.length - 1]! : info;
  })();

  return {
    id,
    title,
    url: buildYoutubeWatchUrl(id),
    thumbnailUrl: youtubeThumbnailUrl(id),
    durationSeconds,
    durationLabel: lengthLabel ?? (durationSeconds != null ? formatDurationSeconds(durationSeconds) : null),
    position: Number.isFinite(position) ? position : fallbackPosition,
    uploadedLabel,
  };
}

function extractVideosFromYtData(root: unknown): PlaylistVideoDTO[] {
  const renderers = walkFind(root, (obj) => {
    const r = obj.playlistVideoRenderer;
    if (r && typeof r === "object") return r as Record<string, unknown>;
    return null;
  });
  const videos: PlaylistVideoDTO[] = [];
  for (let i = 0; i < renderers.length; i++) {
    const video = parsePlaylistVideoRenderer(renderers[i]!, i + 1);
    if (video) videos.push(video);
  }
  return videos;
}

function extractYtInitialData(html: string): unknown {
  const patterns = [
    /var ytInitialData\s*=\s*(\{[\s\S]*?\});\s*<\/script>/,
    /ytInitialData\s*=\s*(\{[\s\S]*?\});\s*<\/script>/,
  ];
  for (const pattern of patterns) {
    const m = html.match(pattern);
    if (!m?.[1]) continue;
    try {
      return JSON.parse(m[1]);
    } catch {
      // try next
    }
  }
  throw new Error("Could not parse YouTube playlist page.");
}

function extractInnertubeApiKey(html: string): string {
  const m = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
  return m?.[1] || "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";
}

async function fetchPlaylistPageHtml(playlistId: string): Promise<string> {
  const url = `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}&hl=en`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": YT_WEB_UA,
      "Accept-Language": "en-US,en;q=0.9",
    },
    // Playlist HTML is >2MB — Next.js data cache rejects it; use in-memory cache instead.
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`YouTube playlist page returned ${res.status}.`);
  }
  return res.text();
}

async function fetchContinuationVideos(
  apiKey: string,
  continuation: string
): Promise<{ videos: PlaylistVideoDTO[]; nextTokens: string[] }> {
  const res = await fetch(
    `https://www.youtube.com/youtubei/v1/browse?key=${encodeURIComponent(apiKey)}&prettyPrint=false`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": YT_WEB_UA,
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: "WEB",
            clientVersion: "2.20241126.01.00",
            hl: "en",
            gl: "SG",
          },
        },
        continuation,
      }),
      cache: "no-store",
    }
  );
  if (!res.ok) {
    throw new Error(`YouTube continuation returned ${res.status}.`);
  }
  const data: unknown = await res.json();
  return {
    videos: extractVideosFromYtData(data),
    nextTokens: extractContinuationTokens(data),
  };
}

async function fetchPlaylistViaWeb(playlistId: string): Promise<PlaylistSnapshotDTO> {
  const html = await fetchPlaylistPageHtml(playlistId);
  const initial = extractYtInitialData(html);
  const videos = extractVideosFromYtData(initial);
  const apiKey = extractInnertubeApiKey(html);

  // YouTube embeds multiple continuation tokens; only some load more playlist videos.
  let pendingTokens = extractContinuationTokens(initial);
  const tried = new Set<string>();
  let guard = 0;
  while (pendingTokens.length && guard < 40) {
    guard += 1;
    const token = pendingTokens.shift();
    if (!token || tried.has(token)) continue;
    tried.add(token);

    const page = await fetchContinuationVideos(apiKey, token);
    if (page.videos.length === 0) continue;

    videos.push(...page.videos);
    for (const next of page.nextTokens) {
      if (!tried.has(next)) pendingTokens.push(next);
    }
  }

  // Deduplicate, then sort by playlist position (1 = top of YouTube list).
  const seen = new Set<string>();
  const unique = videos
    .filter((v) => {
      if (seen.has(v.id)) return false;
      seen.add(v.id);
      return true;
    })
    .sort((a, b) => a.position - b.position);

  const title = extractPlaylistTitle(initial) ?? "Session videos";
  const reportedCount = extractVideoCount(initial);

  return {
    id: playlistId,
    title,
    videoCount: reportedCount ?? unique.length,
    playlistUrl: sessionPlaylistUrl(playlistId),
    videos: unique,
    source: "web",
    fetchedAt: new Date().toISOString(),
  };
}

interface YoutubeApiPlaylistItem {
  snippet?: {
    title?: string;
    position?: number;
    resourceId?: { videoId?: string };
    thumbnails?: { medium?: { url?: string }; high?: { url?: string }; default?: { url?: string } };
  };
  contentDetails?: { videoId?: string; videoPublishedAt?: string };
}

interface YoutubeApiVideoItem {
  id?: string;
  contentDetails?: { duration?: string };
}

async function fetchPlaylistViaApi(
  playlistId: string,
  apiKey: string
): Promise<PlaylistSnapshotDTO> {
  const videos: PlaylistVideoDTO[] = [];
  let pageToken: string | undefined;
  let playlistTitle = "Session videos";
  let reportedCount = 0;

  const playlistMetaRes = await fetch(
    `https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&id=${encodeURIComponent(playlistId)}&key=${encodeURIComponent(apiKey)}`,
    { cache: "no-store" }
  );
  if (playlistMetaRes.ok) {
    const meta = (await playlistMetaRes.json()) as {
      items?: Array<{
        snippet?: { title?: string };
        contentDetails?: { itemCount?: number };
      }>;
    };
    const item = meta.items?.[0];
    if (item?.snippet?.title) playlistTitle = item.snippet.title;
    if (typeof item?.contentDetails?.itemCount === "number") {
      reportedCount = item.contentDetails.itemCount;
    }
  }

  do {
    const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
    url.searchParams.set("part", "snippet,contentDetails");
    url.searchParams.set("maxResults", "50");
    url.searchParams.set("playlistId", playlistId);
    url.searchParams.set("key", apiKey);
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`YouTube Data API playlistItems returned ${res.status}.`);
    }
    const data = (await res.json()) as {
      nextPageToken?: string;
      items?: YoutubeApiPlaylistItem[];
    };

    for (const item of data.items ?? []) {
      const id =
        item.contentDetails?.videoId ??
        item.snippet?.resourceId?.videoId ??
        null;
      if (!id || !VIDEO_ID_RE.test(id)) continue;
      const title = item.snippet?.title?.trim() || id;
      const position =
        typeof item.snippet?.position === "number" ? item.snippet.position + 1 : videos.length + 1;
      videos.push({
        id,
        title,
        url: buildYoutubeWatchUrl(id),
        thumbnailUrl:
          item.snippet?.thumbnails?.medium?.url ||
          item.snippet?.thumbnails?.high?.url ||
          item.snippet?.thumbnails?.default?.url ||
          youtubeThumbnailUrl(id),
        durationSeconds: null,
        durationLabel: null,
        position,
        uploadedLabel: null,
      });
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  // Enrich durations in batches of 50.
  for (let i = 0; i < videos.length; i += 50) {
    const batch = videos.slice(i, i + 50);
    const ids = batch.map((v) => v.id).join(",");
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${encodeURIComponent(ids)}&key=${encodeURIComponent(apiKey)}`,
      { cache: "no-store" }
    );
    if (!res.ok) continue;
    const data = (await res.json()) as { items?: YoutubeApiVideoItem[] };
    const byId = new Map(
      (data.items ?? [])
        .filter((item): item is YoutubeApiVideoItem & { id: string } => typeof item.id === "string")
        .map((item) => [item.id, item] as const)
    );
    for (const video of batch) {
      const duration = byId.get(video.id)?.contentDetails?.duration;
      if (!duration) continue;
      const seconds = parseIso8601Duration(duration);
      video.durationSeconds = seconds;
      video.durationLabel = seconds != null ? formatDurationSeconds(seconds) : null;
    }
  }

  return {
    id: playlistId,
    title: playlistTitle,
    videoCount: reportedCount || videos.length,
    playlistUrl: sessionPlaylistUrl(playlistId),
    videos,
    source: "api",
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Load all videos from the session recordings playlist.
 * Prefers YouTube Data API when `YOUTUBE_API_KEY` is set; otherwise scrapes the public playlist page.
 */
export async function fetchSessionPlaylist(
  playlistId = getSessionPlaylistId()
): Promise<PlaylistSnapshotDTO> {
  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  if (apiKey) {
    try {
      return await fetchPlaylistViaApi(playlistId, apiKey);
    } catch {
      // Fall through to web scrape.
    }
  }
  return fetchPlaylistViaWeb(playlistId);
}

const PLAYLIST_CACHE_TTL_MS = 15 * 60 * 1000;

type PlaylistCacheEntry = {
  expiresAt: number;
  value: PlaylistSnapshotDTO;
};

let memoryCache: PlaylistCacheEntry | null = null;
let inflight: Promise<PlaylistSnapshotDTO> | null = null;

/** Cached playlist snapshot (15 min). Safe for serverless warm instances + local/dev. */
export async function getCachedSessionPlaylist(
  playlistId = getSessionPlaylistId(),
  options?: { force?: boolean }
): Promise<PlaylistSnapshotDTO> {
  const now = Date.now();
  if (
    !options?.force &&
    memoryCache &&
    memoryCache.expiresAt > now &&
    memoryCache.value.id === playlistId
  ) {
    return memoryCache.value;
  }
  if (options?.force) {
    memoryCache = null;
    inflight = null;
  }
  if (!inflight) {
    inflight = fetchSessionPlaylist(playlistId)
      .then((value) => {
        memoryCache = { value, expiresAt: Date.now() + PLAYLIST_CACHE_TTL_MS };
        return value;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}
