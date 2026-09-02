# Email notifications (Resend)

**Date:** 2026-09-02  
**Status:** Approved for planning  
**Product:** Bestminton (single team)

## Problem

Members now have optional emails (synced from Splitwise or edited in management). The team wants automated email notifications for match scheduling, registration reminders, and settlement events — without relying on players checking the app manually.

## Goals

- Send bilingual (Vietnamese + English) emails via **Resend** when key events happen.
- Match reminders at exactly **96h** and **48h** before `scheduledAt`, only to **unregistered** members.
- New-match announcements to all members with email who are **not yet registered** for that match.
- Settlement notifications to directly affected parties; kèo resolve also notifies all bettors.
- Global per-member email opt-out, editable by captain (management) and by the member (profile).
- Idempotent delivery — no duplicate emails for the same event/recipient.
- Emails are optional infrastructure: when `RESEND_API_KEY` is unset, skip silently (same pattern as Splitwise bridge).

## Non-goals (v1)

- Chinese email copy.
- Per-category opt-out (match vs settlement).
- Push / SMS notifications.
- Emails in IndexedDB/local-only mode (requires Postgres).
- Automatic retry queue for failed sends (log failures; idempotency allows manual re-send only by changing entity key or admin intervention).
- Resend scheduled-send API (use daily cron + window matching instead).

## Decisions (brainstorming)

| Topic | Choice |
| --- | --- |
| Architecture | **Option 2:** shared `lib/email/` module + `EmailDelivery` idempotency/audit table |
| Provider | Resend |
| New match (recurring) | Only the **nearest** upcoming instance gets `MATCH_CREATED`; later instances rely on reminders |
| New match recipients | All members with email + notifications on, **except** those already registered |
| Reminder recipients | Unregistered members only |
| Reminder timing | Exactly **96h** and **48h** before `scheduledAt` (not calendar days) |
| Kèo resolve recipients | All 4 players + all bettors (deduped) |
| Drink settle recipients | Debtor + creditor |
| Ledger record recipients | All members with an expense share |
| Ledger mark-paid recipients | Debtor + creditor |
| Email language | Bilingual VI + EN in every email |
| Opt-out | Global toggle only; captain (management) **and** member (profile) |

## Architecture

```
API route / daily cron
    → notifyMembers({ eventType, entityKey, recipients, templateData })
        → for each recipient:
            → skip if no email, opt-out, or Resend not configured
            → skip if EmailDelivery exists with status SENT for (memberId, eventType, entityKey)
            → render bilingual template → Resend API
            → on success: insert EmailDelivery (status SENT)
            → on failure: log error (no SENT row → safe to retry on next cron window for reminders)
```

Routes invoke `notifyMembers` via Vercel `waitUntil()` so HTTP responses are not blocked.

```
lib/email/
  client.ts       — Resend wrapper (no-op when unconfigured)
  notify.ts       — recipient filtering, idempotency, send orchestration
  types.ts        — event enums, template payloads
  templates/      — one file per template (HTML + plain text)
  reminders.ts    — 96h/48h window matching for cron
```

## Data model

### Member (add field)

| Field | Type | Notes |
| --- | --- | --- |
| `emailNotificationsEnabled` | `Boolean` | Default `true`. When `false`, skip all notification emails. |

Existing `email` field unchanged (`String?`, normalized via `normalizeMemberEmail`).

### EmailDelivery (new table)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | Int PK | |
| `memberId` | Int FK → Member | |
| `eventType` | Enum | See events below |
| `entityKey` | String | Idempotency scope (e.g. `match:42:reminder-96h`) |
| `status` | Enum | `SENT` only persisted on success |
| `resendId` | String? | Resend message id |
| `error` | String? | Last error message (optional; only if we log failed attempts later) |
| `sentAt` | DateTime | When successfully delivered |
| *(unique)* | `(memberId, eventType, entityKey)` | Prevents duplicate sends |

**Idempotency rule:** Only insert a row when Resend returns success. Failed sends do not create a `SENT` row, so the daily reminder cron can retry within the ±12h window.

### EmailEventType enum

`MATCH_CREATED` | `MATCH_REMINDER_96H` | `MATCH_REMINDER_48H` | `CHALLENGE_RESOLVED` | `DRINK_DEBT_SETTLED` | `LEDGER_RECORDED` | `LEDGER_MARK_PAID`

## Notification events

| Event | Trigger | Recipients | entityKey pattern |
| --- | --- | --- | --- |
| `MATCH_CREATED` | `POST /api/matches` | Members with email, notifications on, **not registered** for that match | `match:{matchId}:created` |
| `MATCH_REMINDER_96H` | Daily cron | Same filter, **unregistered only** | `match:{matchId}:reminder-96h` |
| `MATCH_REMINDER_48H` | Daily cron | Same | `match:{matchId}:reminder-48h` |
| `CHALLENGE_RESOLVED` | `POST /api/challenges/[id]/resolve` | Players (A, A2, B, B2) + all bettors, deduped | `challenge:{challengeId}:resolved` |
| `DRINK_DEBT_SETTLED` | `POST /api/debts/settle` | Debtor + creditor | `drink:{debtorId}:{creditorId}:{settledAmount}` |
| `LEDGER_RECORDED` | `POST /api/ledger/record` | All members with a share on the created expense(s) | `expense:{expenseId}:recorded` |
| `LEDGER_MARK_PAID` | `POST /api/ledger/settle` | Debtor + creditor | `ledger-paid:{debtorId}:{creditorId}:{amountCents}:{shareIdsFingerprint}` |

**Recurring matches:** `POST /api/matches` with `isRecurring` creates up to 4 instances. Fire `MATCH_CREATED` only for the instance with the earliest `scheduledAt`. Other instances get reminders only.

**`shareIdsFingerprint`:** Hash or sorted join of `ExpenseShare.id` values updated by the FIFO mark-paid operation (may require returning share ids from `markLedgerPaid` for notification hook).

## Cron: match reminders

**Route:** `GET /api/cron/match-reminders`  
**Schedule:** `0 16 * * *` (daily, midnight VN — Vercel Hobby limit) in `vercel.json`  
**Auth:** `CRON_SECRET` Bearer token when set; otherwise `x-vercel-cron` on Vercel

**Window logic** (`lib/email/reminders.ts`):

For each upcoming match (`scheduledAt > now`):

- If `scheduledAt - now` is within **±12 hours** of 96 hours → send `MATCH_REMINDER_96H` to unregistered members.
- If within **±12 hours** of 48 hours → send `MATCH_REMINDER_48H`.

Hourly cron + 30 min tolerance ensures the reminder fires close to the exact 96h/48h mark without needing sub-hour scheduling.

## Email content

Each email: **Vietnamese block first**, horizontal rule, **English block**, footer with opt-out note:

> *Bạn có thể tắt email trong hồ sơ của mình / You can disable emails on your profile.*

| Template | Content |
| --- | --- |
| New match | Title, venue, local date/time, link to `/matches/{id}` |
| Reminder 96h / 48h | Same + urgency (“4 days / 2 days left”) |
| Kèo resolved | Winner, score, handicap, Elo changes (singles), drink summary if applicable, link to `/challenges/{id}` |
| Drink settled | “{debtor} paid {creditor} {n} ly nước cam” |
| Ledger recorded | Match/expense title, member’s share, who paid, link to `/balances` |
| Ledger mark-paid | “{debtor} marked {amount} paid to {creditor}” |

HTML + plain-text multipart. Styling: minimal, mobile-friendly, inline CSS.

## Environment variables

```env
RESEND_API_KEY=           # unset = email bridge off
EMAIL_FROM=Bestminton <notifications@yourdomain.com>  # verified Resend domain
APP_BASE_URL=https://...  # deep links in templates
```

Add to `CLAUDE.md` env section when implementing.

## UI changes

### Management — `MemberForm`

- Checkbox: “Email notifications” (`emailNotificationsEnabled`), default on.

### Member profile — `/members/[id]`

- Toggle: enable/disable email notifications.
- Requires **member PIN** (same gate as other mutating player actions).
- `PUT /api/members/[id]` accepts `emailNotificationsEnabled` (member PIN for self-edit; captain PIN for management).

## API integration points

| File | Change |
| --- | --- |
| `app/api/matches/route.ts` | After create, `notifyMembers(MATCH_CREATED)` for nearest instance only |
| `app/api/cron/match-reminders/route.ts` | New daily cron |
| `app/api/challenges/[id]/resolve/route.ts` | After resolve, notify players + bettors |
| `app/api/debts/settle/route.ts` | After settle, notify debtor + creditor |
| `app/api/ledger/record/route.ts` | After record, notify all share holders |
| `app/api/ledger/settle/route.ts` | After mark-paid, notify debtor + creditor |
| `app/api/members/[id]/route.ts` | Accept `emailNotificationsEnabled` |
| `vercel.json` | Add daily match-reminders cron |
| `prisma/schema.prisma` | `emailNotificationsEnabled`, `EmailDelivery` model |
| `lib/types.ts`, serialize, localDb | Mirror new member field (localDb: no-op for email) |

## Error handling

- Resend not configured → return early, no error to client.
- Resend API error → `console.error`, no `EmailDelivery` row (reminders can retry within window).
- Member without email → skip silently.
- Opt-out → skip silently.
- Duplicate idempotency key with `SENT` → skip silently.

Event-triggered notifications must never fail the parent API mutation.

## Testing

| Area | Approach |
| --- | --- |
| Reminder windows | Unit test `reminders.ts` — boundary cases at 96h/48h ±30m |
| Recipient filters | Unit test registered vs unregistered, opt-out, no email |
| Idempotency | Unit test duplicate `entityKey` does not double-send |
| Templates | Snapshot or string-contains tests for VI + EN blocks |
| Resend client | Mocked; no live API in CI |
| Integration | Manual with Resend dev + verified domain |

## Dependencies

- `resend` npm package

## Security & privacy

- Emails contain only team-visible data (match details, amounts).
- Opt-out is per-member; no unsubscribe link required for v1 (small closed team), but profile link is documented in footer.
- Captain PIN / member PIN gates unchanged on mutating routes.
