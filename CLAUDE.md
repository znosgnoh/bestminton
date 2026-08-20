# Project: Bestminton — Badminton Session Manager

## 1. Overview

A full-stack web application that helps a badminton team manage their sessions end-to-end:

- **Captains** access `/management` directly (not linked in the nav) to register members, schedule matches (single or recurring weekly), and manage **kèo** (friendly Elo challenges with optional drink-token betting). When `CAPTAIN_PIN` is set, the management UI and captain-only API mutations require that PIN (see §8–9).
- **Players** visit the homepage, see upcoming matches, and self-register by tapping their avatar. They can also add guests with an optional name and Full / Half-time playtime flag. From **Kèo** (`/challenges`) they can view active challenges, place bets while a kèo is pending, and check the Elo leaderboard.
- **After a match**, the captain opens the match from `/management` → past match row → clipboard icon, enters the total court cost, hours played, and who paid. The app calculates each player's weighted share and syncs the expense directly to a Splitwise group (PIN required on those APIs when `CAPTAIN_PIN` is set).

---

## 2. Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Frontend:** React 19, TailwindCSS v4, Lucide Icons
- **Language:** TypeScript
- **Database:** Vercel Postgres via Prisma ORM
- **Local fallback:** IndexedDB (browser) — detected via `/api/health`
- **Deployment:** Vercel

---

## 3. Database Schema (Prisma)

### Member

Registered players in the team.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | Int (PK) | Auto-increment |
| `name` | String | Display name |
| `avatarUrl` | String? | Optional profile image URL |
| `splitwiseId` | Int? | Splitwise user ID (unique) |
| `eloRating` | Int | Default 1000; updated when kèo complete |
| `totalMatches` | Int | Challenge match count |
| `totalWins` | Int | Challenge wins |
| `createdAt` | DateTime | |

### Match

A scheduled badminton session.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | Int (PK) | Auto-increment |
| `title` | String | e.g. "Tuesday Night Bminton" |
| `venue` | String | Court location |
| `scheduledAt` | DateTime | Date + start time |
| `hours` | Float? | Playing duration (set after match) |
| `totalCost` | Float? | Court fee (set after match) |
| `paidByMemberId` | Int? | FK → Member who paid |
| `shuttlecockRecipientMemberId` | Int? | FK → Member who receives shuttlecock fee (settle) |
| `isRecurring` | Boolean | Whether to auto-generate weekly |
| `recurDayOfWeek` | Int? | 0=Sun … 6=Sat (when recurring) |
| `synced` | Boolean | Whether Splitwise sync completed |
| `createdAt` | DateTime | |

### MatchRegistration

Which players joined a given match.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | Int (PK) | Auto-increment |
| `matchId` | Int (FK) | → Match |
| `memberId` | Int (FK) | → Member |
| `playedFull` | Boolean | `true` = full time, `false` = half time (default `true`) |
| `joinedAt` | DateTime | Self-registration timestamp |
| *(unique)* | `(matchId, memberId)` | |

### Guest

Guests attached to a registered player (share that player's cost).

| Field | Type | Notes |
| --- | --- | --- |
| `id` | Int (PK) | Auto-increment |
| `label` | String? | Optional name (e.g. "Wife") |
| `playedFull` | Boolean | `true` = full time, `false` = half time (default `true`) |
| `registrationId` | Int (FK) | → MatchRegistration |

### Challenge (kèo)

Friendly singles/doubles match with optional drink-token betting. **Singles** update member Elo on resolve; **doubles** skip Elo/`totalMatches`/`totalWins` changes (separate 2v2 Elo planned later) but use the same optional `isDrinkChallenge` flag as singles. UI copy uses Vietnamese **kèo** terminology.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | Int (PK) | Auto-increment |
| `format` | Enum | `SINGLES` or `DOUBLES` |
| `status` | Enum | `PENDING` → `ACTIVE` → `COMPLETED` |
| `playerAId`, `playerBId` | Int (FK) | Side competitors |
| `playerA2Id`, `playerB2Id` | Int? (FK) | Doubles partners |
| `handicapPoints` | Int | Points given to the weaker side (system-calculated from Elo; not user-editable) |
| `confirmedHandicapPoints` | Int? | Captain-confirmed handicap at resolve (for future algo tuning) |
| `confirmedScore` | String? | Captain-confirmed final score at resolve (e.g. `21-15, 21-18`) |
| `notes` | String? | Optional custom rules or extra info (editable while `PENDING`) |
| `isDrinkChallenge` | Boolean | Drink-token ledger (optional for singles and doubles) |
| `winnerSide`, `winnerId` | Enum / Int? | Set on resolve |
| `resolutionSnapshot` | Json? | Payout / Elo snapshot at completion |
| `createdAt`, `completedAt` | DateTime | |

### Bet

| Field | Type | Notes |
| --- | --- | --- |
| `challengeId`, `bettorId` | Int (FK) | One bet per bettor per kèo |
| `side` | Enum | `A` or `B` |
| `amount` | Int | Stake (default 1 token) |

### DrinkDebt

Pairwise drink-token balances between members (`debtorId`, `creditorId`, `amount`).

### Expense

Court-money ledger entry (match fee, shuttlecock remittance, or Splitwise opening).

| Field | Type | Notes |
| --- | --- | --- |
| `id` | Int (PK) | Auto-increment |
| `kind` | Enum | `MATCH`, `SHUTTLECOCK`, `OPENING` |
| `matchId` | Int? | FK → Match (`ON DELETE SET NULL`) |
| `title` | String | |
| `amount` | Decimal | |
| `currency` | String | |
| `paidByMemberId` | Int | FK → Member (creditor) |
| `status` | Enum | `OPEN` or `SETTLED` |
| `splitwiseExpenseId` | BigInt? | Splitwise expense id when dual-written (BIGINT — IDs exceed INT4) |
| `createdAt` | DateTime | |
| *(unique)* | `(matchId, kind)` | |

### ExpenseShare

Who owes how much on an expense (`owed − paid` is the remainder).

| Field | Type | Notes |
| --- | --- | --- |
| `id` | Int (PK) | Auto-increment |
| `expenseId` | Int | FK → Expense |
| `memberId` | Int | FK → Member (debtor) |
| `owed` | Decimal | Weighted share |
| `paid` | Decimal | FIFO mark-paid amount (default 0) |
| *(unique)* | `(expenseId, memberId)` | |

---

## 4. Core Logic & Cost Calculation Formula

Total court fee is split weighted by playtime and headcount per player.

**Formula:**

- `playerFactor_i = 1.0` if full time, `0.5` if half time
- `guestsFactor_i = Σ (1.0 if guest.playedFull else 0.5)` for each guest of player i
- `W_i = hours × (playerFactor_i + guestsFactor_i)`
- `W_total = Σ W_i`
- `Owed_i = TotalCost × (W_i / W_total)`

**Rounding:** Shares are rounded to 2 decimal places. Any cent discrepancy is added to / subtracted from the first participant's share so `Σ Owed_i = TotalCost` exactly (required by Splitwise).

**Court-money ledger:** Per-share remainders (`owed − paid`) are summed pairwise (debtor = share member, creditor = `paidByMemberId`), then collapsed with `simplifyDebts` for the `/balances` display. Mark-paid is FIFO on the **direct** pair only (same debtor share + `paidByMemberId === creditor`). Nước cam stays on `DrinkDebt`.

**Shuttlecock display (settle UI):** Total entered is still one amount. For display only:

- `shuttlecockFee = min(SHUTTLECOCK_FEE_PER_HOUR × hours, totalCost)` (default rate **7.5** / hour via env)
- `courtFee = totalCost − shuttlecockFee`
- Weighted shares still split the **full total** to **Paid By**. UI notes that Paid By remits shuttlecock to the selected **Shuttlecock** recipient (defaults to Tiến Hoàng).
- On Splitwise sync (non-**single**-title matches): a second expense logs Paid By → Shuttlecock recipient for the shuttlecock fee. Titles matching `/singles?/` skip that remittance. Description = `{title} · {date}`.
- **Backfill:** Management → Past → “Backfill shuttlecock → Tiến Hoàng” (`POST /api/splitwise/backfill-shuttlecock`) creates remittances for past settled matches not yet flagged `shuttlecockRemitted`.

### Internationalization (i18n)

- **Locales:** `vi` (VN), `en` (EN), `zh` (CN / Simplified Chinese) — switch via flag dropdown in the header.
- **Storage:** `localStorage` key `bestminton_locale` (+ cookie for future SSR); browser language detection on first visit.
- **API:** `useI18n()` → `{ locale, setLocale, t }` from `contexts/LocaleContext.tsx`; message catalogs in `lib/i18n/messages/{en,vi,zh}.ts`.
- **Pattern:** Add keys to all three locale files; use `t("namespace.key", { param })` in client components. Not every screen is migrated yet — extend catalogs as you touch UI.


Implemented in `lib/elo.ts`. Player-facing explanation with examples and charts: **Leaderboard** (`/leaderboard#elo-guideline`, `components/leaderboard/EloGuideline.tsx`, data in `lib/eloGuideline.ts`). Kèo pages link via `EloGuidelineLink`.

- **Suggested handicap:** Sub-linear scaling from average side Elo gap — calibrated so a 300-point gap suggests 6 points; doubling the gap yields ~1.5× points (not 2×). The weaker side receives the handicap. **System-only:** create and `PENDING` updates cannot override it (`POST` ignores client `handicapPoints`; `PATCH` rejects it). Changing 21/15 while `PENDING` recalculates the suggestion. Resolve still confirms handicap + score for Elo.
- **Stale pending kèo:** `PENDING` challenges (never started or resolved) are deleted 3 days after `createdAt`. `ACTIVE` and `COMPLETED` are kept. Cleanup runs on kèo list/detail loads and hourly via `GET /api/cron/stale-challenges`. Bets cascade.
- **Displayed win rate:** `sideWinProbabilities` treats each handicap point as a **50 Elo** boost on the recipient (`ELO_PER_HANDICAP_POINT`), then applies the standard Elo expected-score formula. Win percentages follow the system handicap.
- **Resolve — singles:** `computeSinglesEloChanges` in `lib/elo.ts` — `newRating = old + K × scoreMarginMult × eloGapMult × (actual − expected)`, where **expected** uses `confirmedHandicapPoints` (handicap-adjusted), **scoreMarginMult** parses `confirmedScore` (close 2-1 / 21-19 → smaller swing; straight-set / large margins → up to ~1.5×), **eloGapMult** scales upsets vs expected favorites, **K** is 32 (&lt;10 kèo) or 16 (established). Updates `eloRating`, `totalMatches`, and `totalWins`; optional nước cam debts when `isDrinkChallenge` or bets exist.
- **Resolve — doubles:** Handicap/win % still use current singles Elo averages; no Elo/`totalMatches`/`totalWins` updates (`resolutionSnapshot.eloChanges` is empty). When `isDrinkChallenge` and no bets: each winner earns exactly 1 ly nước cam, debtor is a loser on the opposing side (round-robin across losers, not fixed pairs). Bet debts unchanged (1:1 bettor vs counterparty).

---

## 5. Application Routes

| Path | Type | Description |
| --- | --- | --- |
| `/` | Page | Homepage — upcoming & past matches (tabs) |
| `/matches/[id]` | Page | Match detail — registration, guest management |
| `/matches/[id]?manage=1` | Page | Match detail with Settle section (captain only) |
| `/management` | Page | Admin — members, matches, kèo; PIN gate when `CAPTAIN_PIN` set |
| `/challenges` | Page | Kèo list (active / history) |
| `/challenges/new` | Page | Create a new kèo |
| `/challenges/[id]` | Page | Kèo detail — betting board, start/resolve (captain) |
| `/leaderboard` | Page | Elo rankings |
| `/balances` | Page | Court-money ledger — My / Group tabs (Sổ) |
| `/api/health` | Route | `GET` DB availability check |
| `/api/admin/verify-pin` | Route | `POST` verify captain PIN (client gate) |
| `/api/challenges` | Route | `GET` list (purges stale pending), `POST` create |
| `/api/challenges/[id]` | Route | `GET` detail, `PATCH` notes/21-15/drink/YouTube, `PUT` edit winner, `DELETE` |
| `/api/cron/stale-challenges` | Route | `GET` hourly cron — delete `PENDING` kèo older than 3 days |
| `/api/challenges/[id]/bets` | Route | `POST` upsert bet, `DELETE` remove |
| `/api/challenges/[id]/start` | Route | `POST` lock bets and start kèo |
| `/api/challenges/[id]/resolve` | Route | `POST` record winner, confirmed handicap/score, Elo, payouts |
| `/api/leaderboard` | Route | `GET` Elo leaderboard |
| `/api/debts` | Route | `GET` drink debt ledger |
| `/api/ledger` | Route | `GET` court-money ledger snapshot |
| `/api/ledger/record` | Route | `POST` record match expenses on the ledger (then Splitwise if bridge on) |
| `/api/ledger/import` | Route | `POST` import Splitwise nets as `OPENING` balances (PIN; bridge on) |
| `/api/ledger/settle` | Route | `POST` mark a simplified edge paid (PIN, FIFO) |
| `/api/members` | Route | `GET` list, `POST` create |
| `/api/members/[id]` | Route | `PUT` update, `DELETE` remove |
| `/api/matches` | Route | `GET` list, `POST` create |
| `/api/matches/[id]` | Route | `GET` detail, `PUT` update, `DELETE` remove |
| `/api/matches/[id]/register` | Route | `POST` self-register, `DELETE` unregister |
| `/api/matches/[id]/guests` | Route | `POST` add guest |
| `/api/matches/[id]/guests/[guestId]` | Route | `PUT` update guest (playtime), `DELETE` remove |
| `/api/splitwise/members` | Route | `GET` fetch Splitwise group members |
| `/api/splitwise/expense` | Route | `POST` thin PIN + `matchId` wrapper around ledger record (returns 502 if Splitwise fails); **clients use `/api/ledger/record`** |
| `/api/upload/avatar` | Route | `POST` upload member avatar (JPG/PNG, max 2MB) to Vercel Blob |

**Captain PIN on APIs:** When `CAPTAIN_PIN` (or legacy `ADMIN_PIN`) is set, mutating captain routes require the PIN in the JSON body (`pin`) or `X-Captain-Pin` header. This includes member/match CRUD, settlement `PUT` on `/api/matches/[id]`, ledger record/import/mark-paid, Splitwise sync/import, avatar upload, and challenge admin actions. `dataService` attaches the stored session PIN via `lib/adminPinClient.ts`. Read-only routes (e.g. `GET /api/members`) stay open.

---

## 6. User Flows

### 6.1 Captain — Setup

1. Navigate directly to `/management` (not linked in nav — captain-only URL). If `CAPTAIN_PIN` is configured, enter it once per browser tab (`ManagementGate` + `sessionStorage`).
2. Add team members (name, optional avatar URL, optional Splitwise ID)
3. Create a match: title, venue, date/time, recurring toggle
4. Optionally create or manage kèo from the **Kèo** section or `/challenges/new` — adjust suggested handicap before starting

### 6.2 Player — Self-Registration

1. Open homepage `/`
2. See **Upcoming** tab (default)
3. Tap a match card → opens `/matches/[id]`
4. Tap own avatar/name to toggle attendance
5. Optionally tap **+ Guest** → form with optional name + Full/½ time toggle

### 6.3 Captain — Post-Match Settlement

1. Open `/management` (unlock PIN first if required)
2. In the **Past** tab, tap the clipboard icon on a past match → `/matches/[id]?manage=1` (settlement uses the same stored PIN for save/sync when `CAPTAIN_PIN` is set)
3. Enter Total Cost ($), Who Paid, Hours Played → Save
4. Review calculated shares per player (with playtime and guest breakdown)
5. Click **Sync to Splitwise** → expense created in the group

### 6.4 Kèo (challenges)

1. Captain or players open **Kèo** in the nav → `/challenges`
2. **New kèo:** pick singles/doubles competitors; review system handicap (Elo-based, not editable) → `PENDING`
3. While `PENDING`, others place bets on a side. Unused pending kèo are auto-removed after 3 days.
4. Captain **starts** the kèo → `ACTIVE` (bets locked; no longer eligible for auto-clean)
5. After play, captain **resolves** — confirms handicap + final score, then picks winning side → **singles:** Elo + optional drink payouts; **doubles:** optional drink payouts only (no Elo)

---

## 7. Splitwise API Integration

- **CORS constraint:** All Splitwise calls go through Next.js route handlers — never from the browser directly.
- **Member import:** `/management` can import members from Splitwise via `GET /api/splitwise/members` to pre-fill Splitwise IDs.
- **Expense creation:** Settle records the in-app ledger first (`POST /api/ledger/record`). When the Splitwise bridge is on, the same action dual-writes to Splitwise. `POST /api/splitwise/expense` is a thin server wrapper (PIN + `matchId`); clients must not call it.
- **Bridge:** `SPLITWISE_API_KEY` and `SPLITWISE_GROUP_ID` both set = bridge **on**. Unset = bridge **off**; ledger and `/balances` still work, Import Splitwise balances is hidden, and settle does not require `splitwiseId`.
- **Avatar uploads:** Stored in Vercel Blob via `POST /api/upload/avatar`. Requires `BLOB_READ_WRITE_TOKEN` (auto-set when a Blob store is linked in Vercel). Without it, captains can still paste avatar URLs.

---

## 8. Environment Variables

```env
# Database (Vercel Postgres)
POSTGRES_URL=
POSTGRES_PRISMA_URL=
POSTGRES_URL_NON_POOLING=

# Splitwise (optional — both set = bridge on / dual-write; unset = bridge off, ledger still works)
SPLITWISE_API_KEY=
SPLITWISE_GROUP_ID=
SPLITWISE_CURRENCY_CODE=USD

# Shuttlecock fee display (optional — settle UI breakdown; default 7.5)
SHUTTLECOCK_FEE_PER_HOUR=7.5

# Vercel Blob (optional — only needed for avatar file uploads)
BLOB_READ_WRITE_TOKEN=

# Captain PIN (optional — gates /management UI and captain mutating APIs when set)
CAPTAIN_PIN=
# ADMIN_PIN=          # legacy alias for CAPTAIN_PIN

# Optional — Vercel Cron Authorization: Bearer CRON_SECRET for GET /api/cron/stale-challenges
CRON_SECRET=
```

**Splitwise cutover:** Unset `SPLITWISE_API_KEY` and `SPLITWISE_GROUP_ID` to turn the bridge **off**. Settle still records the in-app ledger (`POST /api/ledger/record` via `dataService.recordMatchLedger`); the settle button is **Record expense** and does not require `splitwiseId`. “Import Splitwise balances” is hidden. Drink debts (`DrinkDebt`) are unchanged.

---

## 9. Key Implementation Notes

- **Dual storage:** `lib/dataService.ts` calls `/api/health` on first use; if DB is unavailable it falls back to `lib/localDb.ts` (IndexedDB). All mutations go through `dataService.*`.
- **Management access:** `/management` is intentionally not linked in the nav header. It is accessible by typing the URL directly. `ManagementGate` prompts for `CAPTAIN_PIN` when the env var is set; unlock state and PIN live in `sessionStorage` (`lib/adminPinClient.ts`, `hooks/useAdminPin.ts`). Server routes use `requireAdminPin` in `lib/apiHelpers.ts`. If `CAPTAIN_PIN` is unset, no gate and APIs accept mutations without a PIN (local dev convenience).
- **Settlement URL:** The Settle section (`SettleForm`) only renders when `?manage=1` is present in the URL — enforced at the server page level. Saving settlement or recording the ledger (`dataService.recordMatchLedger`) sends the stored captain PIN when configured. Bridge on dual-writes Splitwise; bridge off records the ledger only.
- **Kèo copy:** Challenge UI uses Vietnamese **kèo** labels in the product; routes remain `/challenges` for URLs.
- **Recurring matches:** Creating a recurring match auto-generates instances for the next 8 weeks at the same day/time.
- **After Prisma migrations:** Run `npx prisma migrate deploy` (or `migrate dev` locally) so the DB matches `schema.prisma`, then `npx prisma generate` and restart the dev server. Resolve (`POST /api/challenges/[id]/resolve`) requires migration `20260626120000_challenge_resolve_confirmation` (`confirmedHandicapPoints`, `confirmedScore` on `Challenge`); without it the transaction rolls back after Elo updates and the API returns 503. Splitwise sync requires `20260820120000_splitwise_expense_id_bigint` (`Expense.splitwiseExpenseId` as BIGINT).
