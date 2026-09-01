import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderMatchEmail } from "./templates/match";

describe("renderMatchEmail", () => {
  it("includes Vietnamese and English blocks", () => {
    const email = renderMatchEmail({
      recipientName: "Alice",
      title: "Tuesday Night",
      venue: "Court 1",
      scheduledAt: new Date("2026-09-10T18:00:00+08:00"),
      matchUrl: "https://app.example/matches/1",
      kind: "created",
    });
    assert.match(email.html, /Trận cầu lông mới/i);
    assert.match(email.html, /New badminton session/i);
    assert.match(email.text, /Tuesday Night/);
  });
});
