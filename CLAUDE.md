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

Friendly singles/doubles match with Elo tracking and optional token betting. UI copy uses Vietnamese **kèo** terminology.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | Int (PK) | Auto-increment |
| `format` | Enum | `SINGLES` or `DOUBLES` |
| `status` | Enum | `PENDING` → `ACTIVE` → `COMPLETED` |
| `playerAId`, `playerBId` | Int (FK) | Side competitors |
| `playerA2Id`, `playerB2Id` | Int? (FK) | Doubles partners |
| `handicapPoints` | Int | Points given to the weaker side (editable before start) |
| `isDrinkChallenge` | Boolean | Drink-token ledger vs abstract tokens |
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

### Elo, suggested handicap, and win rate

Implemented in `lib/elo.ts`.

- **Suggested handicap:** Sub-linear scaling from average side Elo gap — calibrated so a 300-point gap suggests 6 points; doubling the gap yields ~1.5× points (not 2×). The weaker side receives the handicap.
- **Editable handicap:** On create (`/challenges/new`) and while status is `PENDING` (management or `HandicapEditor`), captains can override the suggestion.
- **Displayed win rate:** `sideWinProbabilities` treats each handicap point as a **50 Elo** boost on the recipient (`ELO_PER_HANDICAP_POINT`), then applies the standard Elo expected-score formula. Win percentages update when handicap changes.

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
| `/api/health` | Route | `GET` DB availability check |
| `/api/admin/verify-pin` | Route | `POST` verify captain PIN (client gate) |
| `/api/challenges` | Route | `GET` list, `POST` create |
| `/api/challenges/[id]` | Route | `GET` detail, `PUT` update (e.g. handicap), `DELETE` |
| `/api/challenges/[id]/bets` | Route | `POST` upsert bet, `DELETE` remove |
| `/api/challenges/[id]/start` | Route | `POST` lock bets and start kèo |
| `/api/challenges/[id]/resolve` | Route | `POST` record winner, Elo, payouts |
| `/api/leaderboard` | Route | `GET` Elo leaderboard |
| `/api/debts` | Route | `GET` drink debt ledger |
| `/api/members` | Route | `GET` list, `POST` create |
| `/api/members/[id]` | Route | `PUT` update, `DELETE` remove |
| `/api/matches` | Route | `GET` list, `POST` create |
| `/api/matches/[id]` | Route | `GET` detail, `PUT` update, `DELETE` remove |
| `/api/matches/[id]/register` | Route | `POST` self-register, `DELETE` unregister |
| `/api/matches/[id]/guests` | Route | `POST` add guest |
| `/api/matches/[id]/guests/[guestId]` | Route | `PUT` update guest (playtime), `DELETE` remove |
| `/api/splitwise/members` | Route | `GET` fetch Splitwise group members |
| `/api/splitwise/expense` | Route | `POST` create Splitwise expense |
| `/api/upload/avatar` | Route | `POST` upload member avatar (JPG/PNG, max 2MB) to Vercel Blob |

**Captain PIN on APIs:** When `CAPTAIN_PIN` (or legacy `ADMIN_PIN`) is set, mutating captain routes require the PIN in the JSON body (`pin`) or `X-Captain-Pin` header. This includes member/match CRUD, settlement `PUT` on `/api/matches/[id]`, Splitwise sync/import, avatar upload, and challenge admin actions. `dataService` attaches the stored session PIN via `lib/adminPinClient.ts`. Read-only routes (e.g. `GET /api/members`) stay open.

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
2. **New kèo:** pick singles/doubles competitors; review sub-linear **suggested handicap** and edit if needed → `PENDING`
3. While `PENDING`, others place bets on a side; captain can still edit handicap (win % reflects current points)
4. Captain **starts** the kèo → `ACTIVE` (bets locked)
5. After play, captain **resolves** with the winning side → Elo updates, token/drink payouts recorded

---

## 7. Splitwise API Integration

- **CORS constraint:** All Splitwise calls go through Next.js route handlers — never from the browser directly.
- **Member import:** `/management` can import members from Splitwise via `GET /api/splitwise/members` to pre-fill Splitwise IDs.
- **Expense creation:** `POST /api/splitwise/expense` receives the calculated shares and transforms them into Splitwise's `users__i__field` flat payload format.
- **Env vars required for sync only:** `SPLITWISE_API_KEY` and `SPLITWISE_GROUP_ID`. The app runs fully without these; the sync button is disabled if they are absent.
- **Avatar uploads:** Stored in Vercel Blob via `POST /api/upload/avatar`. Requires `BLOB_READ_WRITE_TOKEN` (auto-set when a Blob store is linked in Vercel). Without it, captains can still paste avatar URLs.

---

## 8. Environment Variables

```env
# Database (Vercel Postgres)
POSTGRES_URL=
POSTGRES_PRISMA_URL=
POSTGRES_URL_NON_POOLING=

# Splitwise (optional — only needed for expense sync)
SPLITWISE_API_KEY=
SPLITWISE_GROUP_ID=
SPLITWISE_CURRENCY_CODE=USD

# Vercel Blob (optional — only needed for avatar file uploads)
BLOB_READ_WRITE_TOKEN=

# Captain PIN (optional — gates /management UI and captain mutating APIs when set)
CAPTAIN_PIN=
# ADMIN_PIN=          # legacy alias for CAPTAIN_PIN
```

---

## 9. Key Implementation Notes

- **Dual storage:** `lib/dataService.ts` calls `/api/health` on first use; if DB is unavailable it falls back to `lib/localDb.ts` (IndexedDB). All mutations go through `dataService.*`.
- **Management access:** `/management` is intentionally not linked in the nav header. It is accessible by typing the URL directly. `ManagementGate` prompts for `CAPTAIN_PIN` when the env var is set; unlock state and PIN live in `sessionStorage` (`lib/adminPinClient.ts`, `hooks/useAdminPin.ts`). Server routes use `requireAdminPin` in `lib/apiHelpers.ts`. If `CAPTAIN_PIN` is unset, no gate and APIs accept mutations without a PIN (local dev convenience).
- **Settlement URL:** The Settle section (`SettleForm`) only renders when `?manage=1` is present in the URL — enforced at the server page level. Saving settlement or syncing Splitwise sends the stored captain PIN when configured.
- **Kèo copy:** Challenge UI uses Vietnamese **kèo** labels in the product; routes remain `/challenges` for URLs.
- **Recurring matches:** Creating a recurring match auto-generates instances for the next 8 weeks at the same day/time.
- **After Prisma migrations:** Always run `npx prisma generate` after any schema change, then restart the dev server so the new client is loaded.
