import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderMonthlyDebtReminderEmail } from "./templates/debtReminder";
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
    // 18:00 Asia/Singapore wall time should appear in the email body.
    assert.match(email.html, /18:00/);
    assert.match(email.html, /text-align:justify/);
    assert.match(email.html, /Bestminton/);
  });
});

describe("renderMonthlyDebtReminderEmail", () => {
  it("includes personal and group debt sections", () => {
    const email = renderMonthlyDebtReminderEmail({
      recipientName: "Alice",
      recipientMemberId: 1,
      monthLabel: "2026-01",
      currency: "SGD",
      edges: [
        {
          debtorId: 1,
          debtorName: "Alice",
          creditorId: 2,
          creditorName: "Bob",
          amount: 12.5,
        },
        {
          debtorId: 3,
          debtorName: "Carol",
          creditorId: 1,
          creditorName: "Alice",
          amount: 5,
        },
      ],
      balancesUrl: "https://app.example/balances",
    });
    assert.match(email.subject, /Month-end clear debts/);
    assert.match(email.html, /Alice nợ Bob/);
    assert.match(email.html, /Alice owes Bob/);
    assert.match(email.html, /Carol nợ Alice/);
    assert.match(email.html, /Báo cáo nhóm/);
    assert.match(email.html, /Group report/);
    assert.match(email.html, /\/balances/);
  });
});
