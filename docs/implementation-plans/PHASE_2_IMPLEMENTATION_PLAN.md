# Implementation Plan — Phase 2: Challenge & Ranking System

**Scope:** US-42 through US-58 (`docs/backlog/phase-2/`)
**Stack:** Next.js 16 · React 19 · TypeScript · TailwindCSS v4 · Prisma · Vercel Postgres
**Prerequisite:** Phase 1 complete (`docs/backlog/phase-1/`, `docs/implementation-plans/IMPLEMENTATION_PLAN_V2.md`)

**Product constraints (non-negotiable):**
- No user authentication (NextAuth / JWT forbidden).
- Shared-device UX: tap name to bet; admin actions gated by PIN.
- Challenge features require a live database — **no IndexedDB fallback** (unlike Phase 1 session manager).

**Naming note:** Phase 2 spec uses `User`; this plan extends the existing `Member` model to avoid duplicate identity tables.

---

## 1. Delta File Tree

Files marked `[NEW]` are created fresh. `[UPDATE]` modifies existing files. Unlisted files are untouched.

```
bestminton/
│
├── prisma/
│   └── schema.prisma                              [UPDATE] Member fields + Challenge + Bet
│
├── app/
│   ├── layout.tsx                                 [UPDATE] Nav links: Challenges, Leaderboard
│   ├── challenges/
│   │   ├── page.tsx                               [NEW] Challenge list (US-55)
│   │   ├── new/
│   │   │   └── page.tsx                           [NEW] Create challenge form (US-46, US-44)
│   │   └── [id]/
│   │       ├── page.tsx                           [NEW] Server page — fetch challenge + members
│   │       └── ChallengeDetailClient.tsx          [NEW] Betting board + admin controls
│   ├── leaderboard/
│   │   └── page.tsx                               [NEW] Elo rankings (US-54)
│   └── api/
│       ├── admin/
│       │   └── verify-pin/
│       │       └── route.ts                       [NEW] POST — server-side PIN check (US-56)
│       ├── leaderboard/
│       │   └── route.ts                           [NEW] GET — ranked members (US-54)
│       └── challenges/
│           ├── route.ts                           [NEW] GET list, POST create (US-43, US-46)
│           └── [id]/
│               ├── route.ts                       [NEW] GET detail (US-47, US-55)
│               ├── start/
│               │   └── route.ts                   [NEW] POST PENDING → ACTIVE (US-50)
│               ├── resolve/
│               │   └── route.ts                   [NEW] POST ACTIVE → COMPLETED (US-51–53, US-52)
│               └── bets/
│                   ├── route.ts                   [NEW] POST upsert, DELETE remove (US-48, US-49)
│                   └── [bettorId]/
│                       └── route.ts               [NEW] DELETE single bet (US-48)
│
├── components/
│   ├── challenges/
│   │   ├── ChallengeCard.tsx                      [NEW] Row in list view (US-55)
│   │   ├── ChallengeForm.tsx                      [NEW] 1v1 / 2v2 player picker (US-46, US-44)
│   │   ├── ChallengeMatchInfo.tsx                 [NEW] Elo, probability, handicap (US-47)
│   │   ├── BettingBoard.tsx                       [NEW] Two-column layout (US-48)
│   │   ├── BettingColumn.tsx                      [NEW] Single side column + pool count
│   │   ├── BettorRow.tsx                          [NEW] Checkbox row with mutual exclusion (US-49)
│   │   ├── ChallengeAdminControls.tsx             [NEW] Start / Resolve buttons (US-50, US-51)
│   │   ├── ChallengeResultSummary.tsx             [NEW] Post-resolve Elo + payout breakdown (US-53)
│   │   └── LeaderboardTable.tsx                   [NEW] Ranked member table (US-54)
│   └── ui/
│       ├── AdminPinModal.tsx                      [NEW] PIN entry dialog (US-56)
│       └── StatusBadge.tsx                        [NEW] PENDING / ACTIVE / COMPLETED badge
│
├── hooks/
│   └── useAdminPin.ts                             [NEW] sessionStorage unlock state (US-56)
│
└── lib/
    ├── types.ts                                   [UPDATE] Challenge/Bet DTOs + API contracts
    ├── elo.ts                                     [NEW] Win probability, handicap, rating update (US-47, US-52)
    ├── betting.ts                                 [NEW] Pari-mutuel pool math + integer rounding (US-53, US-57)
    ├── challengeIncludes.ts                       [NEW] Prisma include shapes (mirror prismaIncludes.ts)
    ├── challengeSerialize.ts                      [NEW] DB → DTO mapper
    ├── challengeService.ts                        [NEW] Start / resolve transactions (US-50–53)
    ├── adminPin.ts                                [NEW] Server PIN validation helper (US-56)
    └── dataService.ts                             [UPDATE] Challenge CRUD wrappers (API-only, no local fallback)
```

---

## 2. Prisma Schema Changes

### 2.1 Extend `Member` (US-42)

```prisma
model Member {
  id           Int      @id @default(autoincrement())
  name         String
  avatarUrl    String?
  splitwiseId  Int?     @unique
  eloRating    Int      @default(1200)
  totalMatches Int      @default(0)
  totalWins    Int      @default(0)
  tokenBalance Int      @default(0)
  createdAt    DateTime @default(now())

  // existing relations …
  betsPlaced    Bet[]       @relation("BetBettor")
  challengesWon Challenge[] @relation("ChallengeWinner")
}
```

### 2.2 New enums

```prisma
enum ChallengeFormat {
  SINGLES
  DOUBLES
}

enum ChallengeStatus {
  PENDING
  ACTIVE
  COMPLETED
}

enum ChallengeSide {
  A
  B
}
```

### 2.3 `Challenge` (US-43, US-44)

Use optional partner IDs for doubles instead of a separate team table — keeps queries simple for a single shared-device screen.

```prisma
model Challenge {
  id             Int             @id @default(autoincrement())
  format         ChallengeFormat @default(SINGLES)
  status         ChallengeStatus @default(PENDING)
  playerAId      Int
  playerA2Id     Int?            // doubles partner (Side A)
  playerBId      Int
  playerB2Id     Int?            // doubles partner (Side B)
  handicapPoints Int             @default(0)
  winnerSide     ChallengeSide?  // set on resolve (canonical for 1v1 and 2v2)
  winnerId       Int?            // playerAId or playerBId — denormalized for 1v1 display / US-43 AC
  createdAt      DateTime        @default(now())
  completedAt    DateTime?

  playerA   Member @relation("ChallengePlayerA", fields: [playerAId], references: [id])
  playerA2  Member? @relation("ChallengePlayerA2", fields: [playerA2Id], references: [id])
  playerB   Member @relation("ChallengePlayerB", fields: [playerBId], references: [id])
  playerB2  Member? @relation("ChallengePlayerB2", fields: [playerB2Id], references: [id])
  winner    Member? @relation("ChallengeWinner", fields: [winnerId], references: [id])
  bets      Bet[]
}
```

**Creation rules:**
- `SINGLES`: `playerA2Id` and `playerB2Id` must be `null`; all four IDs distinct not required (only A ≠ B).
- `DOUBLES`: all four IDs required and distinct.
- `handicapPoints` computed server-side on create from Elo (`round(abs(Ra - Rb) / 50)` using side-average ratings).

### 2.4 `Bet` (US-45)

```prisma
model Bet {
  id          Int           @id @default(autoincrement())
  challengeId Int
  bettorId    Int
  side        ChallengeSide // A or B — cleaner than predictedWinnerId for doubles
  amount      Int           @default(1)
  createdAt   DateTime      @default(now())

  challenge Challenge @relation(fields: [challengeId], references: [id], onDelete: Cascade)
  bettor    Member    @relation("BetBettor", fields: [bettorId], references: [id])

  @@unique([challengeId, bettorId])
}
```

**Migration:** `npx prisma migrate dev --name phase2_challenges` then `npx prisma generate`.

---

## 3. Core Types (`lib/types.ts`)

### 3.1 Member extension

```typescript
export interface MemberDTO {
  id: number;
  name: string;
  avatarUrl: string | null;
  splitwiseId: number | null;
  eloRating: number;
  totalMatches: number;
  totalWins: number;
  tokenBalance: number;
}

export interface LeaderboardEntryDTO extends MemberDTO {
  rank: number;
  winRate: number; // totalWins / totalMatches, 0 if no matches
}
```

### 3.2 Challenge shapes

```typescript
export type ChallengeFormat = "SINGLES" | "DOUBLES";
export type ChallengeStatus = "PENDING" | "ACTIVE" | "COMPLETED";
export type ChallengeSide = "A" | "B";

export interface ChallengePlayerDTO {
  id: number;
  name: string;
  avatarUrl: string | null;
  eloRating: number;
}

export interface ChallengeSideDTO {
  players: ChallengePlayerDTO[];
  averageElo: number;
  winProbability: number; // 0–1
  poolTokens: number;
  poolBets: number;
}

export interface BetDTO {
  id: number;
  challengeId: number;
  bettorId: number;
  side: ChallengeSide;
  amount: number;
  bettor: Pick<MemberDTO, "id" | "name" | "avatarUrl" | "tokenBalance">;
}

export interface ChallengeDTO {
  id: number;
  format: ChallengeFormat;
  status: ChallengeStatus;
  handicapPoints: number;
  handicapRecipientSide: ChallengeSide; // lower-Elo side
  winnerSide: ChallengeSide | null;
  winnerId: number | null;
  createdAt: string;
  completedAt: string | null;
  sideA: ChallengeSideDTO;
  sideB: ChallengeSideDTO;
  bets: BetDTO[];
  /** Populated after COMPLETED */
  resolution?: ChallengeResolutionDTO;
}

export interface ChallengeResolutionDTO {
  eloChanges: Array<{
    memberId: number;
    name: string;
    before: number;
    after: number;
    delta: number;
  }>;
  payouts: Array<{
    bettorId: number;
    name: string;
    side: ChallengeSide;
    stake: number;
    payout: number; // net change (negative = loss)
  }>;
}
```

### 3.3 API request contracts

```typescript
/** POST /api/challenges */
export interface CreateChallengeRequest {
  format: ChallengeFormat;
  playerAId: number;
  playerA2Id?: number;
  playerBId: number;
  playerB2Id?: number;
}

/** POST /api/challenges/[id]/bets */
export interface UpsertBetRequest {
  bettorId: number;
  side: ChallengeSide;
}

/** POST /api/challenges/[id]/resolve */
export interface ResolveChallengeRequest {
  winnerSide: ChallengeSide;
  pin?: string; // required when CAPTAIN_PIN / ADMIN_PIN is set
}

/** POST /api/challenges/[id]/start */
export interface StartChallengeRequest {
  pin?: string;
}

/** POST /api/admin/verify-pin */
export interface VerifyPinRequest {
  pin: string;
}
```

---

## 4. Core Math Logic

### 4.1 `lib/elo.ts` (US-47, US-52)

```typescript
export const DEFAULT_ELO = 1200;
export const K_FACTOR_NEW = 32;
export const K_FACTOR_ESTABLISHED = 16;
export const K_MATCH_THRESHOLD = 10;

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export function suggestedHandicap(ratingA: number, ratingB: number): number {
  return Math.round(Math.abs(ratingA - ratingB) / 50);
}

export function kFactor(totalMatches: number): number {
  return totalMatches < K_MATCH_THRESHOLD ? K_FACTOR_NEW : K_FACTOR_ESTABLISHED;
}

export function newRating(
  oldRating: number,
  actual: 0 | 1,
  expected: number,
  totalMatches: number
): number {
  const k = kFactor(totalMatches);
  return Math.round(oldRating + k * (actual - expected));
}

/** Average Elo for a side (1 or 2 players). */
export function sideAverageElo(ratings: number[]): number {
  return ratings.reduce((s, r) => s + r, 0) / ratings.length;
}
```

**Doubles Elo update (US-44):** For each player on Side A, compute `expected = expectedScore(player.elo, opponentSideAverage)`; `actual = 1` if Side A won else `0`; apply `newRating`. Repeat for Side B players against Side A average.

**Handicap recipient:** Side with lower `averageElo` receives `handicapPoints`.

### 4.2 `lib/betting.ts` (US-53, US-57)

Fixed stake `DEFAULT_BET_AMOUNT = 1` (from `lib/constants.ts` or top of betting.ts).

```typescript
export interface BetInput {
  bettorId: number;
  side: ChallengeSide;
  amount: number;
}

export interface PayoutResult {
  bettorId: number;
  stake: number;
  payout: number; // net token change
}

/**
 * Pari-mutuel resolution. All amounts are integers (tokens).
 *
 * Rules (US-53, US-57):
 * - Losers on wrong side lose full stake.
 * - Winning pool receives losing pool distributed proportionally by stake.
 * - No bets: empty arrays, no balance changes.
 * - Only winning-side bets: each winner gets stake back (payout = 0 net).
 * - Only losing-side bets: stakes burned (no recipients).
 */
export function resolvePariMutuel(
  bets: BetInput[],
  winnerSide: ChallengeSide
): PayoutResult[] {
  // Implementation steps:
  // 1. Partition bets into poolA / poolB
  // 2. If no bets → return []
  // 3. If winnerSide has bettors but loser pool empty → payout 0 for each winner
  // 4. If loser pool has tokens but winner pool empty → losers lose stake, burn tokens
  // 5. Else: losers get payout = -stake;
  //    winners share loserPoolTotal proportionally:
  //      share_i = stake_i / winnerPoolTotal
  //      payout_i = stake_i + floor(share_i * loserPoolTotal)  -- use cent-style remainder on first winner
}
```

**Integer remainder handling (mirrors US-08 / `lib/calculations.ts`):**
1. Compute each winner's raw payout as a float.
2. Floor to integers.
3. Distribute leftover tokens one-by-one to winners with largest fractional remainders until `sum(payouts) = winnerPoolTotal + loserPoolTotal` conservation holds.

---

## 5. API Route Specifications

### 5.1 `GET /api/challenges` (US-55)

**Response:** `ChallengeDTO[]` (summary — omit `bets` detail, include pool counts).

Query params: `?status=PENDING|ACTIVE|COMPLETED` (optional filter).

Order: `createdAt desc`.

### 5.2 `POST /api/challenges` (US-46, US-43)

**Request body:** `CreateChallengeRequest`

**Validation:**
- All player IDs exist.
- Singles: 2 distinct players; doubles: 4 distinct.
- Reject if DB unavailable → `503`.

**Server logic:**
1. Load player Elo ratings.
2. Compute `sideAAvg`, `sideBAvg`, `handicapPoints`, `handicapRecipientSide`.
3. Insert `Challenge` with `status: PENDING`, computed handicap.

**Response:** `201` + full `ChallengeDTO`.

### 5.3 `GET /api/challenges/[id]` (US-47)

**Response:** Full `ChallengeDTO` including:
- `sideA.winProbability` / `sideB.winProbability` from `expectedScore`.
- `sideA.poolTokens` / `sideB.poolTokens` summed from bets.
- `resolution` block if `COMPLETED` (stored in DB as JSON column **or** recomputed from bets + final balances — prefer storing snapshot on resolve for audit).

**Optional schema addition for audit:**

```prisma
resolutionSnapshot Json? // ChallengeResolutionDTO
```

### 5.4 `POST /api/challenges/[id]/bets` (US-48, US-49)

**Request:** `UpsertBetRequest`

**Preconditions:**
- Challenge `status === PENDING`.
- Bettor exists.
- `bettor.tokenBalance >= amount` (US-58) — v1 disallows negative balances.
- Upsert replaces any existing bet for same `(challengeId, bettorId)` (mutual exclusion enforced by unique constraint + upsert).

**DELETE** `/api/challenges/[id]/bets/[bettorId]` — remove bet while `PENDING`.

**Errors:**
- `409` if challenge not `PENDING`.
- `400` if insufficient tokens.
- `404` if challenge or bettor not found.

### 5.5 `POST /api/challenges/[id]/start` (US-50)

**Request:** `StartChallengeRequest` (optional `pin`)

**Preconditions:**
- `status === PENDING`.
- `verifyAdminPin(pin)` passes (US-56).

**Logic:** `status → ACTIVE`. No bet mutations.

**Errors:** `409` wrong status; `401` bad PIN; `403` if PIN required but missing.

### 5.6 `POST /api/challenges/[id]/resolve` (US-51, US-52, US-53, US-57)

**Request:** `ResolveChallengeRequest`

**Preconditions:**
- `status === ACTIVE`.
- `verifyAdminPin(pin)` passes.
- `winnerSide` is `A` or `B`.

**Transaction (`lib/challengeService.ts` — single `prisma.$transaction`):**

```
1. Load challenge + bets + all involved members (competitors + bettors).
2. Compute Elo changes for each competitor (singles or doubles rules).
3. Compute pari-mutuel payouts via resolvePariMutuel().
4. Update each Member:
   - eloRating, totalMatches, totalWins
   - tokenBalance += payout (for bettors)
5. Update Challenge:
   - status = COMPLETED
   - winnerSide, winnerId (playerAId or playerBId for 1v1; playerAId for 2v2 Side A win)
   - completedAt = now()
   - resolutionSnapshot = { eloChanges, payouts }
6. Return updated ChallengeDTO.
```

**Errors:**
- `409` if not `ACTIVE` or already `COMPLETED`.
- `401` / `403` PIN failures.

### 5.7 `GET /api/leaderboard` (US-54)

**Response:** `LeaderboardEntryDTO[]` sorted by `eloRating desc`, `totalWins desc`, `name asc`.

### 5.8 `POST /api/admin/verify-pin` (US-56)

**Request:** `{ pin: string }`

**Logic:**
```typescript
// lib/adminPin.ts
export function isPinRequired(): boolean {
  return Boolean(process.env.CAPTAIN_PIN ?? process.env.ADMIN_PIN);
}
export function verifyAdminPin(pin?: string): boolean {
  const expected = process.env.CAPTAIN_PIN ?? process.env.ADMIN_PIN;
  if (!expected) return true; // dev mode — no gate
  return pin === expected;
}
```

**Response:** `{ ok: true }` or `401 { error: "Invalid PIN." }`.

Client stores unlock in `sessionStorage` via `useAdminPin` — but **server always re-validates PIN** on start/resolve.

---

## 6. UI Components

### 6.1 Page layout — `app/challenges/[id]/ChallengeDetailClient.tsx`

Single-screen flow (US-47–51). Three vertical sections:

```
┌─────────────────────────────────────┐
│  ChallengeMatchInfo                 │  Player A vs B, Elo, %, handicap
├─────────────────────────────────────┤
│  BettingBoard                       │  Two columns, checkbox per member
│  ┌──────────────┬──────────────┐   │
│  │ Bet on A     │ Bet on B     │   │
│  │ ☑ Alice      │ ☐ Alice (off)│   │
│  │ ☐ Bob        │ ☑ Bob        │   │
│  │ Pool: 3 · 3  │ Pool: 2 · 2  │   │
│  └──────────────┴──────────────┘   │
├─────────────────────────────────────┤
│  ChallengeAdminControls             │  Start / End & Resolve (PIN-gated)
│  ChallengeResultSummary (if done)   │
└─────────────────────────────────────┘
```

### 6.2 Component responsibilities

| Component | Stories | Notes |
| --- | --- | --- |
| `ChallengeForm` | US-46, US-44 | Toggle Singles/Doubles; member picker reuses `AvatarTile` |
| `ChallengeMatchInfo` | US-47 | Displays handicap recipient label |
| `BettingBoard` | US-48, US-49 | Props: `bets`, `members`, `status`, `onToggle(bettorId, side)` |
| `BettorRow` | US-49, US-58 | Disabled if checked on other side, locked if `ACTIVE`, insufficient tokens |
| `ChallengeAdminControls` | US-50, US-51, US-56 | Opens `AdminPinModal` before API call |
| `ChallengeResultSummary` | US-52, US-53 | Shows Elo deltas + payout table |
| `ChallengeCard` | US-55 | Status badge + players + date |
| `LeaderboardTable` | US-54 | Rank, name, Elo, W–L, tokens |
| `AdminPinModal` | US-56 | Reusable for US-33 management gate later |
| `StatusBadge` | US-55 | Color-coded PENDING / ACTIVE / COMPLETED |

### 6.3 Client state pattern

Mirror `MatchDetailClient.tsx`:
- Server page fetches initial `ChallengeDTO` + `MemberDTO[]`.
- Client holds optimistic bet toggles; rollback on API error (US-58).
- Poll or `router.refresh()` after start/resolve.

### 6.4 Navigation (`app/layout.tsx`)

Add header links (visible to all — no login):

```tsx
<nav className="flex gap-3 text-sm">
  <Link href="/">Matches</Link>
  <Link href="/challenges">Challenges</Link>
  <Link href="/leaderboard">Leaderboard</Link>
</nav>
```

`/management` remains unlinked (Phase 1 convention).

---

## 7. Environment Variables

```env
# Existing
POSTGRES_URL=
POSTGRES_PRISMA_URL=
POSTGRES_URL_NON_POOLING=

# Admin gate (optional — unset = no PIN required)
CAPTAIN_PIN=          # preferred; shared with future US-33
ADMIN_PIN=            # alias fallback for Phase 2 spec wording
```

---

## 8. Implementation Steps

Execute in order. Each step ends with a verifiable checkpoint.

### Step 1 — Schema & Types (US-42, US-43, US-45)

**Files:** `prisma/schema.prisma`, `lib/types.ts`, run migration.

- [ ] Add Member ranking fields with defaults.
- [ ] Add Challenge + Bet models and enums.
- [ ] Extend `MemberDTO` and add Challenge/Bet DTOs.
- [ ] Update `GET /api/members` responses (fields flow automatically from Prisma).
- [ ] Update `MemberCard` in management to show Elo/tokens (read-only).

**Checkpoint:** `npx prisma migrate dev` succeeds; existing Phase 1 tests/manual flows still work.

---

### Step 2 — Core Math Libraries (US-47, US-52, US-53, US-57)

**Files:** `lib/elo.ts`, `lib/betting.ts`, `lib/constants.ts` (optional).

- [ ] Unit-test `expectedScore`, `suggestedHandicap`, `newRating`, `kFactor`.
- [ ] Unit-test `resolvePariMutuel` for: no bets, one-sided pools, standard split, integer remainder.

**Checkpoint:** Pure functions covered; no UI yet.

---

### Step 3 — Challenge API: CRUD + List (US-43, US-46, US-55)

**Files:** `app/api/challenges/route.ts`, `app/api/challenges/[id]/route.ts`, `lib/challengeIncludes.ts`, `lib/challengeSerialize.ts`.

- [ ] `POST` creates challenge with computed handicap.
- [ ] `GET` list + detail return `ChallengeDTO` with probabilities and pool sums.
- [ ] Return `503` when DB unavailable.

**Checkpoint:** Create/list challenges via `curl` or REST client.

---

### Step 4 — Betting API (US-45, US-48, US-49, US-58)

**Files:** `app/api/challenges/[id]/bets/route.ts`, `.../bets/[bettorId]/route.ts`.

- [ ] Upsert enforces unique bettor per challenge.
- [ ] DELETE removes bet.
- [ ] Reject mutations when not `PENDING`.
- [ ] Insufficient `tokenBalance` → `400`.

**Checkpoint:** Place bets via API; verify mutual exclusion in DB.

---

### Step 5 — Admin PIN Infrastructure (US-56)

**Files:** `lib/adminPin.ts`, `app/api/admin/verify-pin/route.ts`, `hooks/useAdminPin.ts`, `components/ui/AdminPinModal.tsx`.

- [ ] Client unlock flow with `sessionStorage`.
- [ ] Server validates PIN on start/resolve regardless of client state.

**Checkpoint:** With `CAPTAIN_PIN=1234`, start/resolve fails without PIN, succeeds with PIN.

---

### Step 6 — Start & Resolve API (US-50, US-51, US-52, US-53)

**Files:** `lib/challengeService.ts`, `app/api/challenges/[id]/start/route.ts`, `app/api/challenges/[id]/resolve/route.ts`.

- [ ] `start` flips to `ACTIVE`.
- [ ] `resolve` runs full transaction: Elo + tokens + snapshot.
- [ ] State machine guards (US-58): 409 on invalid transitions.

**Checkpoint:** End-to-end API test: create → bet → start → resolve; verify DB balances and Elo.

---

### Step 7 — Challenge UI (US-46–51, US-55)

**Files:** `app/challenges/**`, `components/challenges/**`.

- [ ] `/challenges` list page.
- [ ] `/challenges/new` creation form (singles first).
- [ ] `/challenges/[id]` detail with three-section layout.
- [ ] Optimistic bet toggles with error rollback.

**Checkpoint:** Full shared-device flow works in browser without login.

---

### Step 8 — Leaderboard (US-54)

**Files:** `app/api/leaderboard/route.ts`, `app/leaderboard/page.tsx`, `components/challenges/LeaderboardTable.tsx`.

- [ ] Sorted table with empty state.

**Checkpoint:** Leaderboard reflects post-resolve Elo changes.

---

### Step 9 — Doubles Support (US-44)

**Files:** `ChallengeForm.tsx`, `challengeService.ts`, `elo.ts` (already supports N ratings).

- [ ] 2v2 player picker (4 distinct).
- [ ] UI shows "Side A avg Elo" notation.
- [ ] Resolve updates all 4 competitors.

**Checkpoint:** Doubles challenge completes with correct per-player Elo deltas.

---

### Step 10 — Edge Cases & Polish (US-57, US-58)

- [ ] Empty pool messages on completed challenge.
- [ ] Error banners for network failures.
- [ ] `StatusBadge` on list cards.
- [ ] Update `docs/backlog/STORY_TRACKER.md` as stories ship.

**Checkpoint:** Manual test matrix below passes.

---

## 9. Manual Test Matrix

| Scenario | Expected |
| --- | --- |
| Create singles challenge | Handicap shown; status PENDING |
| Bet on Side A, switch to Side B | Only one bet in DB |
| Start without PIN (PIN set) | 401/403 |
| Start with PIN | ACTIVE; checkboxes disabled |
| Resolve Side A wins | Elo updated; tokens redistributed |
| No bets placed | Elo updates; tokens unchanged |
| Only losers bet | Tokens burned |
| Only winners bet | Stakes returned; net 0 |
| Resolve PENDING challenge | 409 |
| Bet while ACTIVE | 409 |
| Bettor with 0 tokens | Checkbox disabled |

---

## 10. Story → File Mapping

| Story | Primary files |
| --- | --- |
| US-42 | `prisma/schema.prisma`, `lib/types.ts` |
| US-43 | `prisma/schema.prisma`, `app/api/challenges/route.ts` |
| US-44 | `ChallengeForm.tsx`, `lib/challengeService.ts`, `lib/elo.ts` |
| US-45 | `prisma/schema.prisma`, `app/api/challenges/[id]/bets/route.ts` |
| US-46 | `app/challenges/new/page.tsx`, `ChallengeForm.tsx` |
| US-47 | `ChallengeMatchInfo.tsx`, `lib/elo.ts`, `challengeSerialize.ts` |
| US-48 | `BettingBoard.tsx`, `BettorRow.tsx` |
| US-49 | `BettingBoard.tsx` (mutual exclusion logic) |
| US-50 | `ChallengeAdminControls.tsx`, `start/route.ts` |
| US-51 | `ChallengeAdminControls.tsx`, `resolve/route.ts` |
| US-52 | `lib/elo.ts`, `lib/challengeService.ts` |
| US-53 | `lib/betting.ts`, `lib/challengeService.ts`, `ChallengeResultSummary.tsx` |
| US-54 | `app/leaderboard/page.tsx`, `app/api/leaderboard/route.ts` |
| US-55 | `app/challenges/page.tsx`, `ChallengeCard.tsx` |
| US-56 | `lib/adminPin.ts`, `AdminPinModal.tsx`, `useAdminPin.ts` |
| US-57 | `lib/betting.ts` |
| US-58 | All API routes (status guards), `BettorRow.tsx` (insufficient tokens) |

---

## 11. Out of Scope (do not implement in this plan)

- OAuth / NextAuth / JWT user sessions
- Variable bet amounts (fixed 1 token in v1)
- Splitwise sync for negative token balances (future US-59)
- IndexedDB offline mode for challenges
- Supabase migration (continue Vercel Postgres + Prisma unless infra story US-62 is approved)

---

## 12. Suggested PR Slicing

| PR | Steps | Stories |
| --- | --- | --- |
| PR-A | 1–2 | US-42, US-47 (math only) |
| PR-B | 3–4 | US-43, US-45, US-46, US-48, US-49 |
| PR-C | 5–6 | US-50, US-51, US-52, US-53, US-56, US-57, US-58 |
| PR-D | 7–8 | US-55, US-54 + UI polish |
| PR-E | 9 | US-44 |
