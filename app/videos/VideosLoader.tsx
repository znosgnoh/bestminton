import { getCachedSessionPlaylist } from "@/lib/youtubePlaylist";
import VideosClient from "./VideosClient";

export default async function VideosLoader() {
  try {
    const playlist = await getCachedSessionPlaylist();
    return <VideosClient playlist={playlist} error={null} />;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load videos.";
    return <VideosClient playlist={null} error={message} />;
  }
}
