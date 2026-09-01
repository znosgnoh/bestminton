# Email Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send bilingual (VI + EN) Resend emails for match creation, 96h/48h registration reminders, kèo resolve, drink settle, and ledger record/mark-paid — with idempotent delivery and per-member global opt-out.

**Architecture:** Shared `lib/email/` module writes to `EmailDelivery` only after Resend succeeds. API routes and hourly cron call high-level notify helpers via `deferNotification()` (`waitUntil` on Vercel). When `RESEND_API_KEY` is unset, all email code no-ops silently.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript · Prisma · Vercel Postgres · Resend · `@vercel/functions` (`waitUntil`) · `tsx --test`

**Spec:** `docs/superpowers/specs/2026-09-02-email-notifications-design.md`

## Global Constraints

- Read `node_modules/next/dist/docs/` before new App Router route code (Next.js 16).
- Email bridge **on** = `RESEND_API_KEY` set. Bridge **off** = unset; skip silently (no client/API errors).
- `EMAIL_FROM` defaults to `Bestminton <onboarding@resend.dev>` in dev if unset; production should use a verified domain.
- `APP_BASE_URL` defaults to `http://localhost:3000` in dev for deep links.
- Bilingual VI + EN in every email. No Chinese in v1.
- Global opt-out only: `Member.emailNotificationsEnabled` (default `true`).
- Reminder windows: exactly **96h** and **48h** before `scheduledAt`, matched within **±30 minutes** by hourly cron.
- New match email for recurring batch: **nearest** `scheduledAt` instance only.
- New match + reminder recipients: members with email + notifications on, **not registered** for that match.
- Kèo resolve recipients: all 4 players + all bettors (deduped by `memberId`).
- Event-triggered notifications must **never** fail the parent API mutation.
- Tests: `npm test` (`tsx --test lib/**/*.test.ts`). Mock Resend; no live API in CI.
- i18n: add UI keys to `lib/i18n/messages/en.ts`, `vi.ts`, and `zh.ts`.
- localDb: mirror `emailNotificationsEnabled` on `MemberDTO`; no email sending in IndexedDB mode.
- After Prisma migration: `npx prisma migrate deploy` (or `migrate dev` locally), `npx prisma generate`, restart dev server.

---

## File tree

```
bestminton/
├── package.json                                  [UPDATE] resend, @vercel/functions
├── vercel.json                                   [UPDATE] hourly match-reminders cron
├── prisma/
│   ├── schema.prisma                             [UPDATE] emailNotificationsEnabled, EmailDelivery
│   └── migrations/20260902120000_email_notifications/ [NEW]
├── lib/
│   ├── types.ts                                  [UPDATE] MemberDTO field, MarkLedgerPaidResult
│   ├── memberSerialize.ts                        [UPDATE] emailNotificationsEnabled
│   ├── localDb.ts                                [UPDATE] mirror field
│   ├── ledgerService.ts                          [UPDATE] markLedgerPaid returns appliedShareIds
│   └── email/
│       ├── types.ts                              [NEW] event types, template payloads
│       ├── config.ts                             [NEW] isEmailConfigured, getEmailFrom, getAppBaseUrl
│       ├── client.ts                             [NEW] Resend wrapper (injectable for tests)
│       ├── defer.ts                              [NEW] waitUntil / fire-and-forget
│       ├── reminders.ts                          [NEW] 96h/48h window helpers
│       ├── recipients.ts                         [NEW] DB queries for eligible members
│       ├── notify.ts                             [NEW] idempotent send orchestration
│       ├── events.ts                             [NEW] notifyMatchCreated, notifyChallengeResolved, …
│       ├── templates/
│       │   ├── layout.ts                         [NEW] bilingual shell + footer
│       │   ├── match.ts                          [NEW]
│       │   ├── challengeResolved.ts              [NEW]
│       │   ├── drinkSettled.ts                   [NEW]
│       │   └── ledger.ts                         [NEW] record + mark-paid
│       ├── reminders.test.ts                     [NEW]
│       ├── recipients.test.ts                    [NEW]
│       ├── notify.test.ts                        [NEW]
│       └── templates.test.ts                     [NEW]
├── app/api/
│   ├── matches/route.ts                          [UPDATE] defer notifyMatchCreated
│   ├── cron/match-reminders/route.ts             [NEW]
│   ├── challenges/[id]/resolve/route.ts          [UPDATE]
│   ├── debts/settle/route.ts                     [UPDATE]
│   ├── ledger/record/route.ts                    [UPDATE]
│   ├── ledger/settle/route.ts                    [UPDATE]
│   └── members/[id]/
│       ├── route.ts                              [UPDATE] captain emailNotificationsEnabled
│       └── email-preferences/route.ts            [NEW] member PIN self-toggle
├── components/management/MemberForm.tsx          [UPDATE] opt-out checkbox
├── app/members/[id]/MemberProfileClient.tsx      [UPDATE] opt-out toggle + member PIN
├── lib/dataService.ts                            [UPDATE] updateMemberEmailPreferences
├── lib/i18n/messages/{en,vi,zh}.ts               [UPDATE]
└── CLAUDE.md                                     [UPDATE] env vars + routes
```

---

## Core types (`lib/email/types.ts`)

```ts
export type EmailEventType =
  | "MATCH_CREATED"
  | "MATCH_REMINDER_96H"
  | "MATCH_REMINDER_48H"
  | "CHALLENGE_RESOLVED"
  | "DRINK_DEBT_SETTLED"
  | "LEDGER_RECORDED"
  | "LEDGER_MARK_PAID";

export type ReminderKind = "96h" | "48h";

export interface EmailRecipient {
  memberId: number;
  email: string;
  name: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}
```

Extend `lib/types.ts`:

```ts
export interface MemberDTO {
  // ...existing fields
  emailNotificationsEnabled: boolean;
}

export interface UpdateMemberEmailPreferencesRequest {
  emailNotificationsEnabled: boolean;
  pin?: string;
}

export interface MarkLedgerPaidResult {
  snapshot: LedgerSnapshotDTO;
  appliedShareIds: number[];
  appliedCents: number;
}
```

---

### Task 1: Prisma schema & migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260902120000_email_notifications/migration.sql`

**Interfaces:**
- Produces: `EmailEventType` enum, `EmailDelivery` model, `Member.emailNotificationsEnabled`

- [ ] **Step 1: Update schema**

Add to `Member`:

```prisma
emailNotificationsEnabled Boolean @default(true)
emailDeliveries         EmailDelivery[]
```

Add enum + model:

```prisma
enum EmailEventType {
  MATCH_CREATED
  MATCH_REMINDER_96H
  MATCH_REMINDER_48H
  CHALLENGE_RESOLVED
  DRINK_DEBT_SETTLED
  LEDGER_RECORDED
  LEDGER_MARK_PAID
}

model EmailDelivery {
  id        Int            @id @default(autoincrement())
  memberId  Int
  eventType EmailEventType
  entityKey String
  resendId  String?
  sentAt    DateTime       @default(now())

  member Member @relation(fields: [memberId], references: [id], onDelete: Cascade)

  @@unique([memberId, eventType, entityKey])
  @@index([eventType, entityKey])
}
```

- [ ] **Step 2: Create migration SQL**

```sql
ALTER TABLE "Member" ADD COLUMN "emailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TYPE "EmailEventType" AS ENUM (
  'MATCH_CREATED',
  'MATCH_REMINDER_96H',
  'MATCH_REMINDER_48H',
  'CHALLENGE_RESOLVED',
  'DRINK_DEBT_SETTLED',
  'LEDGER_RECORDED',
  'LEDGER_MARK_PAID'
);

CREATE TABLE "EmailDelivery" (
  "id" SERIAL NOT NULL,
  "memberId" INTEGER NOT NULL,
  "eventType" "EmailEventType" NOT NULL,
  "entityKey" TEXT NOT NULL,
  "resendId" TEXT,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailDelivery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmailDelivery_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "EmailDelivery_memberId_eventType_entityKey_key"
  ON "EmailDelivery"("memberId", "eventType", "entityKey");
CREATE INDEX "EmailDelivery_eventType_entityKey_idx"
  ON "EmailDelivery"("eventType", "entityKey");
```

- [ ] **Step 3: Generate client**

Run: `npx prisma generate`  
Expected: succeeds with new types.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260902120000_email_notifications/
git commit -m "feat(db): add email notifications schema"
```

---

### Task 2: Dependencies & email config/client

**Files:**
- Modify: `package.json`
- Create: `lib/email/config.ts`
- Create: `lib/email/client.ts`
- Create: `lib/email/defer.ts`

**Interfaces:**
- Produces: `isEmailConfigured()`, `getEmailFrom()`, `getAppBaseUrl()`, `sendEmail({ to, subject, html, text })`, `deferNotification(fn)`

- [ ] **Step 1: Install packages**

```bash
npm install resend @vercel/functions
```

- [ ] **Step 2: Create `lib/email/config.ts`**

```ts
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export function getEmailFrom(): string {
  return (
    process.env.EMAIL_FROM?.trim() ||
    "Bestminton <onboarding@resend.dev>"
  );
}

export function getAppBaseUrl(): string {
  const raw = process.env.APP_BASE_URL?.trim() || "http://localhost:3000";
  return raw.replace(/\/$/, "");
}
```

- [ ] **Step 3: Create `lib/email/client.ts`**

```ts
import { Resend } from "resend";
import { getEmailFrom, isEmailConfigured } from "./config";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

let resendClient: Resend | null = null;

function getClient(): Resend {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!isEmailConfigured()) return { ok: false, error: "email_not_configured" };
  try {
    const { data, error } = await getClient().emails.send({
      from: getEmailFrom(),
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    if (error) return { ok: false, error: error.message };
    if (!data?.id) return { ok: false, error: "missing_resend_id" };
    return { ok: true, id: data.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "send_failed";
    return { ok: false, error: message };
  }
}
```

- [ ] **Step 4: Create `lib/email/defer.ts`**

```ts
import { waitUntil } from "@vercel/functions";

export function deferNotification(work: () => Promise<void>): void {
  const run = () => work().catch((err) => {
    console.error("[email]", err);
  });
  try {
    waitUntil(run());
  } catch {
    void run();
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json lib/email/config.ts lib/email/client.ts lib/email/defer.ts
git commit -m "feat(email): add Resend client and config"
```

---

### Task 3: Reminder window logic

**Files:**
- Create: `lib/email/reminders.ts`
- Create: `lib/email/reminders.test.ts`

**Interfaces:**
- Produces: `REMINDER_OFFSET_MS`, `REMINDER_WINDOW_MS`, `reminderKindsDue(now, scheduledAt): ReminderKind[]`, `shareIdsFingerprint(ids: number[]): string`

- [ ] **Step 1: Write failing tests**

```ts
// lib/email/reminders.test.ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { reminderKindsDue, shareIdsFingerprint } from "./reminders";

const H = 60 * 60 * 1000;

describe("reminderKindsDue", () => {
  const scheduledAt = new Date("2026-09-10T18:00:00.000Z");

  it("returns 96h inside ±30m window", () => {
    const now = new Date(scheduledAt.getTime() - 96 * H);
    assert.deepEqual(reminderKindsDue(now, scheduledAt), ["96h"]);
  });

  it("returns 48h inside ±30m window", () => {
    const now = new Date(scheduledAt.getTime() - 48 * H);
    assert.deepEqual(reminderKindsDue(now, scheduledAt), ["48h"]);
  });

  it("returns empty outside windows", () => {
    const now = new Date(scheduledAt.getTime() - 72 * H);
    assert.deepEqual(reminderKindsDue(now, scheduledAt), []);
  });

  it("returns empty for past matches", () => {
    const now = new Date(scheduledAt.getTime() + H);
    assert.deepEqual(reminderKindsDue(now, scheduledAt), []);
  });
});

describe("shareIdsFingerprint", () => {
  it("sorts ids for stable key", () => {
    assert.equal(shareIdsFingerprint([3, 1, 2]), "1,2,3");
  });
});
```

- [ ] **Step 2: Run tests (expect FAIL)**

Run: `npm test -- lib/email/reminders.test.ts`  
Expected: module not found.

- [ ] **Step 3: Implement `lib/email/reminders.ts`**

```ts
import type { ReminderKind } from "./types";

export const REMINDER_OFFSET_MS: Record<ReminderKind, number> = {
  "96h": 96 * 60 * 60 * 1000,
  "48h": 48 * 60 * 60 * 1000,
};

export const REMINDER_WINDOW_MS = 30 * 60 * 1000;

export function reminderKindsDue(now: Date, scheduledAt: Date): ReminderKind[] {
  if (scheduledAt.getTime() <= now.getTime()) return [];
  const delta = scheduledAt.getTime() - now.getTime();
  const kinds: ReminderKind[] = [];
  for (const kind of ["96h", "48h"] as const) {
    const target = REMINDER_OFFSET_MS[kind];
    if (Math.abs(delta - target) <= REMINDER_WINDOW_MS) kinds.push(kind);
  }
  return kinds;
}

export function shareIdsFingerprint(ids: number[]): string {
  return [...ids].sort((a, b) => a - b).join(",");
}
```

- [ ] **Step 4: Run tests (expect PASS)**

Run: `npm test -- lib/email/reminders.test.ts`

- [ ] **Step 5: Commit**

```bash
git add lib/email/reminders.ts lib/email/reminders.test.ts
git commit -m "feat(email): add reminder window helpers"
```

---

### Task 4: Email templates

**Files:**
- Create: `lib/email/templates/layout.ts`
- Create: `lib/email/templates/match.ts`
- Create: `lib/email/templates/challengeResolved.ts`
- Create: `lib/email/templates/drinkSettled.ts`
- Create: `lib/email/templates/ledger.ts`
- Create: `lib/email/templates.test.ts`

**Interfaces:**
- Produces: `renderBilingualEmail({ subjectVi, subjectEn, bodyVi, bodyEn })`, `renderMatchEmail(...)`, etc.

- [ ] **Step 1: Write failing template test**

```ts
// lib/email/templates.test.ts
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
    assert.match(email.html, /Trận mới/i);
    assert.match(email.html, /New match/i);
    assert.match(email.text, /Tuesday Night/);
  });
});
```

- [ ] **Step 2: Run test (expect FAIL)**

Run: `npm test -- lib/email/templates.test.ts`

- [ ] **Step 3: Implement `lib/email/templates/layout.ts`**

```ts
import type { RenderedEmail } from "../types";

const FOOTER_VI =
  "Bạn có thể tắt email trong hồ sơ của mình.";
const FOOTER_EN = "You can disable emails on your profile.";

export function renderBilingualEmail(input: {
  subject: string;
  bodyVi: string;
  bodyEn: string;
}): RenderedEmail {
  const html = `
    <div style="font-family:sans-serif;line-height:1.5;color:#111">
      <div>${input.bodyVi}</div>
      <hr style="margin:24px 0;border:none;border-top:1px solid #ddd" />
      <div>${input.bodyEn}</div>
      <p style="margin-top:24px;font-size:12px;color:#666">
        <em>${FOOTER_VI}<br />${FOOTER_EN}</em>
      </p>
    </div>
  `.trim();
  const text = `${input.bodyVi.replace(/<[^>]+>/g, "")}\n\n---\n\n${input.bodyEn.replace(/<[^>]+>/g, "")}\n\n${FOOTER_VI} / ${FOOTER_EN}`;
  return { subject: input.subject, html, text };
}

export function formatMatchDateTime(d: Date): { vi: string; en: string } {
  const vi = d.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
  const en = d.toLocaleString("en-SG", { timeZone: "Asia/Ho_Chi_Minh" });
  return { vi, en };
}
```

- [ ] **Step 4: Implement `lib/email/templates/match.ts`**

```ts
import type { RenderedEmail } from "../types";
import { formatMatchDateTime, renderBilingualEmail } from "./layout";

export function renderMatchEmail(input: {
  recipientName: string;
  title: string;
  venue: string;
  scheduledAt: Date;
  matchUrl: string;
  kind: "created" | "reminder-96h" | "reminder-48h";
}): RenderedEmail {
  const when = formatMatchDateTime(input.scheduledAt);
  const urgencyVi =
    input.kind === "reminder-96h"
      ? "<p><strong>Còn 4 ngày nữa!</strong></p>"
      : input.kind === "reminder-48h"
        ? "<p><strong>Còn 2 ngày nữa!</strong></p>"
        : "";
  const urgencyEn =
    input.kind === "reminder-96h"
      ? "<p><strong>4 days left!</strong></p>"
      : input.kind === "reminder-48h"
        ? "<p><strong>2 days left!</strong></p>"
        : "";
  const headingVi =
    input.kind === "created" ? "Trận cầu lông mới" : "Nhắc đăng ký trận";
  const headingEn =
    input.kind === "created" ? "New badminton session" : "Match registration reminder";

  return renderBilingualEmail({
    subject:
      input.kind === "created"
        ? `[Bestminton] Trận mới / New match: ${input.title}`
        : `[Bestminton] Nhắc trận / Reminder: ${input.title}`,
    bodyVi: `
      <p>Xin chào ${input.recipientName},</p>
      ${urgencyVi}
      <p><strong>${headingVi}</strong></p>
      <ul>
        <li>${input.title}</li>
        <li>${input.venue}</li>
        <li>${when.vi}</li>
      </ul>
      <p><a href="${input.matchUrl}">Đăng ký ngay</a></p>
    `,
    bodyEn: `
      <p>Hi ${input.recipientName},</p>
      ${urgencyEn}
      <p><strong>${headingEn}</strong></p>
      <ul>
        <li>${input.title}</li>
        <li>${input.venue}</li>
        <li>${when.en}</li>
      </ul>
      <p><a href="${input.matchUrl}">Register now</a></p>
    `,
  });
}
```

- [ ] **Step 5: Implement remaining templates** (`challengeResolved.ts`, `drinkSettled.ts`, `ledger.ts`) following the same bilingual pattern with spec copy:
  - Kèo: winner side, score, handicap, optional Elo lines from `resolutionSnapshot`, link `/challenges/{id}`
  - Drink: `{debtorName} trả {creditorName} {amount} ly nước cam`
  - Ledger record: expense title, share amount, paid-by name, `/balances` link
  - Ledger mark-paid: `{debtorName} đã ghi nhận {amount} trả cho {creditorName}`

- [ ] **Step 6: Run template tests**

Run: `npm test -- lib/email/templates.test.ts`  
Add assertions for other templates as implemented.

- [ ] **Step 7: Commit**

```bash
git add lib/email/templates lib/email/templates.test.ts
git commit -m "feat(email): add bilingual notification templates"
```

---

### Task 5: Recipients & idempotent notify core

**Files:**
- Create: `lib/email/recipients.ts`
- Create: `lib/email/notify.ts`
- Create: `lib/email/recipients.test.ts`
- Create: `lib/email/notify.test.ts`

**Interfaces:**
- Produces: `eligibleMemberSelect`, `filterEligibleRecipients(rows)`, `sendToMember({ eventType, entityKey, recipient, render })`, `hasBeenSent(memberId, eventType, entityKey)`

- [ ] **Step 1: Write recipient filter test**

```ts
// lib/email/recipients.test.ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterEligibleRecipients } from "./recipients";

describe("filterEligibleRecipients", () => {
  it("keeps only members with email and notifications enabled", () => {
    const rows = [
      { id: 1, name: "A", email: "a@x.com", emailNotificationsEnabled: true },
      { id: 2, name: "B", email: null, emailNotificationsEnabled: true },
      { id: 3, name: "C", email: "c@x.com", emailNotificationsEnabled: false },
    ];
    assert.deepEqual(filterEligibleRecipients(rows), [
      { memberId: 1, email: "a@x.com", name: "A" },
    ]);
  });
});
```

- [ ] **Step 2: Implement `lib/email/recipients.ts`**

```ts
import { db } from "@/lib/db";
import type { EmailRecipient } from "./types";

export const ELIGIBLE_MEMBER_SELECT = {
  id: true,
  name: true,
  email: true,
  emailNotificationsEnabled: true,
} as const;

type EligibleRow = {
  id: number;
  name: string;
  email: string | null;
  emailNotificationsEnabled: boolean;
};

export function filterEligibleRecipients(rows: EligibleRow[]): EmailRecipient[] {
  return rows
    .filter((m) => m.email && m.emailNotificationsEnabled)
    .map((m) => ({ memberId: m.id, email: m.email!, name: m.name }));
}

export async function unregisteredMembersForMatch(matchId: number): Promise<EmailRecipient[]> {
  const registered = await db.matchRegistration.findMany({
    where: { matchId },
    select: { memberId: true },
  });
  const registeredIds = new Set(registered.map((r) => r.memberId));
  const members = await db.member.findMany({ select: ELIGIBLE_MEMBER_SELECT });
  return filterEligibleRecipients(members).filter((m) => !registeredIds.has(m.memberId));
}
```

- [ ] **Step 3: Write notify idempotency test with mocked send**

```ts
// lib/email/notify.test.ts — use dependency injection or mock sendEmail at module level
// Test: second call with same entityKey does not call sendEmail again
```

Implement `lib/email/notify.ts`:

```ts
import { db } from "@/lib/db";
import { EmailEventType } from "@prisma/client";
import { sendEmail } from "./client";
import { isEmailConfigured } from "./config";
import type { EmailRecipient, RenderedEmail } from "./types";

export async function hasBeenSent(
  memberId: number,
  eventType: EmailEventType,
  entityKey: string
): Promise<boolean> {
  const row = await db.emailDelivery.findUnique({
    where: { memberId_eventType_entityKey: { memberId, eventType, entityKey } },
  });
  return Boolean(row);
}

export async function sendToMember(input: {
  eventType: EmailEventType;
  entityKey: string;
  recipient: EmailRecipient;
  email: RenderedEmail;
}): Promise<"sent" | "skipped" | "failed"> {
  if (!isEmailConfigured()) return "skipped";
  if (await hasBeenSent(input.recipient.memberId, input.eventType, input.entityKey)) {
    return "skipped";
  }
  const result = await sendEmail({
    to: input.recipient.email,
    subject: input.email.subject,
    html: input.email.html,
    text: input.email.text,
  });
  if (!result.ok) {
    console.error("[email] send failed", input.eventType, input.entityKey, result.error);
    return "failed";
  }
  await db.emailDelivery.create({
    data: {
      memberId: input.recipient.memberId,
      eventType: input.eventType,
      entityKey: input.entityKey,
      resendId: result.id,
    },
  });
  return "sent";
}

export async function sendToMany(
  eventType: EmailEventType,
  entityKey: string,
  recipients: EmailRecipient[],
  render: (recipient: EmailRecipient) => RenderedEmail
): Promise<{ sent: number; skipped: number; failed: number }> {
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const recipient of recipients) {
    const outcome = await sendToMember({
      eventType,
      entityKey,
      recipient,
      email: render(recipient),
    });
    if (outcome === "sent") sent += 1;
    else if (outcome === "skipped") skipped += 1;
    else failed += 1;
  }
  return { sent, skipped, failed };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- lib/email/recipients.test.ts lib/email/notify.test.ts`

- [ ] **Step 5: Commit**

```bash
git add lib/email/recipients.ts lib/email/notify.ts lib/email/recipients.test.ts lib/email/notify.test.ts
git commit -m "feat(email): add recipient filters and idempotent sender"
```

---

### Task 6: Event orchestrators

**Files:**
- Create: `lib/email/events.ts`

**Interfaces:**
- Produces: `notifyMatchCreated(matchId)`, `runMatchReminderCron(now?)`, `notifyChallengeResolved(challengeId)`, `notifyDrinkDebtSettled(...)`, `notifyLedgerRecorded(expenseId)`, `notifyLedgerMarkPaid(...)`

- [ ] **Step 1: Implement `lib/email/events.ts`**

Key logic:

```ts
export async function notifyMatchCreated(matchId: number): Promise<void> {
  const match = await db.match.findUnique({ where: { id: matchId } });
  if (!match) return;
  const recipients = await unregisteredMembersForMatch(matchId);
  const matchUrl = `${getAppBaseUrl()}/matches/${matchId}`;
  await sendToMany("MATCH_CREATED", `match:${matchId}:created`, recipients, (r) =>
    renderMatchEmail({
      recipientName: r.name,
      title: match.title,
      venue: match.venue,
      scheduledAt: match.scheduledAt,
      matchUrl,
      kind: "created",
    })
  );
}

export async function runMatchReminderCron(now = new Date()): Promise<{ sent96: number; sent48: number }> {
  const matches = await db.match.findMany({
    where: { scheduledAt: { gt: now } },
    select: { id: true, title: true, venue: true, scheduledAt: true },
  });
  let sent96 = 0;
  let sent48 = 0;
  for (const match of matches) {
    const kinds = reminderKindsDue(now, match.scheduledAt);
    for (const kind of kinds) {
      const eventType = kind === "96h" ? "MATCH_REMINDER_96H" : "MATCH_REMINDER_48H";
      const entityKey = `match:${match.id}:reminder-${kind}`;
      const recipients = await unregisteredMembersForMatch(match.id);
      const result = await sendToMany(eventType, entityKey, recipients, (r) =>
        renderMatchEmail({
          recipientName: r.name,
          title: match.title,
          venue: match.venue,
          scheduledAt: match.scheduledAt,
          matchUrl: `${getAppBaseUrl()}/matches/${match.id}`,
          kind: kind === "96h" ? "reminder-96h" : "reminder-48h",
        })
      );
      if (kind === "96h") sent96 += result.sent;
      else sent48 += result.sent;
    }
  }
  return { sent96, sent48 };
}
```

`notifyChallengeResolved`: load challenge with players + bets; collect unique member ids; load eligible members; `entityKey = challenge:{id}:resolved`.

`notifyDrinkDebtSettled`: load debtor/creditor names; `entityKey = drink:{debtorId}:{creditorId}:{settledAmount}`.

`notifyLedgerRecorded`: for each expense id in response, load shares + expense; one email per share member with their owed amount.

`notifyLedgerMarkPaid`: `entityKey = ledger-paid:{debtorId}:{creditorId}:{appliedCents}:{shareIdsFingerprint(appliedShareIds)}`.

- [ ] **Step 2: Commit**

```bash
git add lib/email/events.ts
git commit -m "feat(email): add event notification orchestrators"
```

---

### Task 7: Match creation hook

**Files:**
- Modify: `app/api/matches/route.ts`

- [ ] **Step 1: Import defer + events**

After successful create(s), pick nearest match for recurring:

```ts
import { deferNotification } from "@/lib/email/defer";
import { notifyMatchCreated } from "@/lib/email/events";

function nearestMatch<T extends { id: number; scheduledAt: Date }>(matches: T[]): T {
  return matches.reduce((a, b) =>
    a.scheduledAt.getTime() <= b.scheduledAt.getTime() ? a : b
  );
}

// non-recurring branch after create:
deferNotification(() => notifyMatchCreated(match.id));

// recurring branch after transaction:
deferNotification(() => notifyMatchCreated(nearestMatch(created).id));
```

- [ ] **Step 2: Manual smoke** — create match with `RESEND_API_KEY` unset; API still 201.

- [ ] **Step 3: Commit**

```bash
git add app/api/matches/route.ts
git commit -m "feat(email): notify on new match creation"
```

---

### Task 8: Hourly reminder cron

**Files:**
- Create: `app/api/cron/match-reminders/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Create cron route** (copy auth from `stale-challenges`)

```ts
import { NextRequest, NextResponse } from "next/server";
import { databaseErrorResponse, requireDatabase } from "@/lib/apiHelpers";
import { runMatchReminderCron } from "@/lib/email/events";

// isAuthorizedCron — same as stale-challenges

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const unavailable = requireDatabase();
  if (unavailable) return unavailable;
  try {
    const result = await runMatchReminderCron();
    return NextResponse.json(result);
  } catch (err) {
    return databaseErrorResponse(err, "GET /api/cron/match-reminders");
  }
}
```

- [ ] **Step 2: Update `vercel.json`**

```json
{
  "crons": [
    { "path": "/api/cron/stale-challenges", "schedule": "0 16 * * *" },
    { "path": "/api/cron/match-reminders", "schedule": "0 * * * *" }
  ]
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/cron/match-reminders/route.ts vercel.json
git commit -m "feat(email): add hourly match reminder cron"
```

---

### Task 9: Settlement & kèo hooks

**Files:**
- Modify: `app/api/challenges/[id]/resolve/route.ts`
- Modify: `app/api/debts/settle/route.ts`
- Modify: `app/api/ledger/record/route.ts`
- Modify: `app/api/ledger/settle/route.ts`
- Modify: `lib/ledgerService.ts`

- [ ] **Step 1: Extend `markLedgerPaid` return type**

Change signature to `Promise<MarkLedgerPaidResult>`. Track `appliedShareIds` inside the FIFO loop (ids where `paid` changed). Return:

```ts
return {
  snapshot: await getLedgerSnapshot(),
  appliedShareIds: [...ids],
  appliedCents: applyCents,
};
```

Update `app/api/ledger/settle/route.ts` to return this object (clients using snapshot can read `.snapshot` or keep backward compat by returning full result — update `dataService.markLedgerPaid` type).

- [ ] **Step 2: Wire defer hooks**

```ts
// resolve
deferNotification(() => notifyChallengeResolved(challengeId));

// debts/settle after success
deferNotification(() =>
  notifyDrinkDebtSettled({ debtorId, creditorId, settled: result.settled })
);

// ledger/record
deferNotification(async () => {
  if (result.matchExpense) await notifyLedgerRecorded(result.matchExpense.id);
  if (result.shuttlecockExpense) await notifyLedgerRecorded(result.shuttlecockExpense.id);
});

// ledger/settle
deferNotification(() =>
  notifyLedgerMarkPaid({
    debtorId,
    creditorId,
    appliedCents: result.appliedCents,
    appliedShareIds: result.appliedShareIds,
  })
);
```

- [ ] **Step 3: Run full test suite**

Run: `npm test`  
Fix any `markLedgerPaid` call sites.

- [ ] **Step 4: Commit**

```bash
git add app/api/challenges/[id]/resolve/route.ts app/api/debts/settle/route.ts \
  app/api/ledger/record/route.ts app/api/ledger/settle/route.ts lib/ledgerService.ts lib/types.ts lib/dataService.ts
git commit -m "feat(email): notify on settlement and kèo resolve"
```

---

### Task 10: Member opt-out API & DTO plumbing

**Files:**
- Modify: `lib/types.ts`, `lib/memberSerialize.ts`, `lib/localDb.ts`
- Modify: `app/api/members/[id]/route.ts`
- Create: `app/api/members/[id]/email-preferences/route.ts`
- Modify: `lib/dataService.ts`

- [ ] **Step 1: Add field to DTO + serialize + localDb**

Update `MemberRow` in `memberSerialize.ts`, `toMemberDTO` in `localDb.ts`, and Prisma selects where members are loaded.

- [ ] **Step 2: Captain PUT accepts `emailNotificationsEnabled`**

In `app/api/members/[id]/route.ts` body type, parse boolean, include in `data` update (admin PIN unchanged).

- [ ] **Step 3: Member self-service route**

```ts
// PATCH app/api/members/[id]/email-preferences/route.ts
export async function PATCH(request, { params }) {
  const unavailable = requireDatabase();
  if (unavailable) return unavailable;
  const body = await request.json();
  const pinDenied = requireMemberPin(memberPinFromRequest(request, body));
  if (pinDenied) return pinDenied;
  if (typeof body.emailNotificationsEnabled !== "boolean") {
    return NextResponse.json({ error: "emailNotificationsEnabled must be a boolean." }, { status: 400 });
  }
  const member = await db.member.update({
    where: { id },
    data: { emailNotificationsEnabled: body.emailNotificationsEnabled },
  });
  return NextResponse.json(await memberToDTO(member));
}
```

- [ ] **Step 4: `dataService.updateMemberEmailPreferences`**

```ts
export function updateMemberEmailPreferences(
  id: number,
  emailNotificationsEnabled: boolean
): Promise<MemberDTO> {
  return via(
    () =>
      apiFetch<MemberDTO>(`/api/members/${id}/email-preferences`, {
        method: "PATCH",
        headers: { ...JSON_HEADERS, ...memberPinHeaders() },
        body: JSON.stringify(withMemberPin({ emailNotificationsEnabled })),
      }),
    () => localDb.updateMember(id, { emailNotificationsEnabled })
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts lib/memberSerialize.ts lib/localDb.ts app/api/members lib/dataService.ts
git commit -m "feat(email): add member email notification preferences API"
```

---

### Task 11: UI — management form & member profile toggle

**Files:**
- Modify: `components/management/MemberForm.tsx`
- Modify: `app/members/[id]/MemberProfileClient.tsx`
- Modify: `lib/i18n/messages/en.ts`, `vi.ts`, `zh.ts`

- [ ] **Step 1: Add i18n keys**

```ts
// en.ts
emailNotifications: "Email notifications",
emailNotificationsHint: "Receive match and settlement emails",

// vi.ts
emailNotifications: "Nhận email thông báo",
emailNotificationsHint: "Nhận email về trận và thanh toán",

// zh.ts
emailNotifications: "邮件通知",
emailNotificationsHint: "接收比赛和结算邮件",
```

- [ ] **Step 2: MemberForm checkbox** (default checked; include in save payload as `emailNotificationsEnabled`)

- [ ] **Step 3: Profile toggle**

Add a labeled checkbox/switch bound to `profile.member.emailNotificationsEnabled`. On change:
1. If member PIN required and not unlocked, prompt PIN modal (reuse `useMemberPin` pattern from balances/kèo).
2. Call `dataService.updateMemberEmailPreferences(id, enabled)`.
3. Refresh profile state.

- [ ] **Step 4: Commit**

```bash
git add components/management/MemberForm.tsx app/members/[id]/MemberProfileClient.tsx lib/i18n/messages/
git commit -m "feat(ui): add email notification opt-out controls"
```

---

### Task 12: Documentation

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add env vars** (`RESEND_API_KEY`, `EMAIL_FROM`, `APP_BASE_URL`)

- [ ] **Step 2: Add routes** (`/api/cron/match-reminders`, `PATCH /api/members/[id]/email-preferences`)

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document email notification env and routes"
```

---

## Manual test plan

1. Set `RESEND_API_KEY`, `EMAIL_FROM` (verified domain), `APP_BASE_URL` in `.env.local`.
2. Ensure members have emails via management or Splitwise sync.
3. Create a non-recurring match → unregistered members receive bilingual email.
4. Create recurring match → only nearest instance triggers new-match email.
5. Set match `scheduledAt` to ~96h from now → hit `GET /api/cron/match-reminders` locally → 96h reminder sent once; second hit skipped (idempotency).
6. Register a member for match → they no longer receive reminders for that match.
7. Resolve a kèo with bets → players + bettors emailed.
8. Settle drink debt → debtor + creditor emailed.
9. Record ledger expense → share holders emailed; mark paid → debtor + creditor emailed.
10. Toggle opt-out on profile → no further emails for that member.
11. Unset `RESEND_API_KEY` → all flows still succeed without email.

---

## Spec coverage self-review

| Spec requirement | Task |
| --- | --- |
| Resend provider | Task 2 |
| EmailDelivery idempotency | Tasks 1, 5 |
| MATCH_CREATED nearest recurring | Tasks 6, 7 |
| 96h/48h reminders, unregistered only | Tasks 3, 6, 8 |
| CHALLENGE_RESOLVED players + bettors | Tasks 9 |
| DRINK_DEBT_SETTLED | Tasks 9 |
| LEDGER_RECORDED + LEDGER_MARK_PAID | Tasks 9 |
| Bilingual VI+EN | Task 4 |
| Global opt-out captain + profile | Tasks 10, 11 |
| Skip when unconfigured | Tasks 2, 5 |
| waitUntil non-blocking | Task 2, 7–9 |
| CLAUDE.md env | Task 12 |

No placeholders remain. Types consistent across tasks (`MarkLedgerPaidResult`, `EmailRecipient`, `ReminderKind`).
