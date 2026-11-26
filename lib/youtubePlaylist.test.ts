import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatDurationSeconds,
  parseIso8601Duration,
  parseYoutubeDurationLabel,
  sessionPlaylistUrl,
  DEFAULT_SESSION_PLAYLIST_ID,
} from "./youtubePlaylist";

describe("parseYoutubeDurationLabel", () => {
  it("parses MM:SS", () => {
    assert.equal(parseYoutubeDurationLabel("57:55"), 57 * 60 + 55);
  });

  it("parses HH:MM:SS", () => {
    assert.equal(parseYoutubeDurationLabel("1:01:37"), 3600 + 60 + 37);
  });

  it("rejects garbage", () => {
    assert.equal(parseYoutubeDurationLabel(""), null);
    assert.equal(parseYoutubeDurationLabel("abc"), null);
  });
});

describe("parseIso8601Duration", () => {
  it("parses common YouTube durations", () => {
    assert.equal(parseIso8601Duration("PT57M55S"), 57 * 60 + 55);
    assert.equal(parseIso8601Duration("PT1H1M37S"), 3600 + 60 + 37);
    assert.equal(parseIso8601Duration("PT45S"), 45);
  });
});

describe("formatDurationSeconds", () => {
  it("formats with and without hours", () => {
    assert.equal(formatDurationSeconds(125), "2:05");
    assert.equal(formatDurationSeconds(3661), "1:01:01");
  });
});

describe("sessionPlaylistUrl", () => {
  it("builds the watch playlist URL", () => {
    assert.equal(
      sessionPlaylistUrl(DEFAULT_SESSION_PLAYLIST_ID),
      `https://www.youtube.com/playlist?list=${DEFAULT_SESSION_PLAYLIST_ID}`
    );
  });
});
