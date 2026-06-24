# Implementation Plan V2 — US-17 through US-28

**Scope:** Database layer, API routes, homepage redesign, match detail page, management page.
**Stack:** Next.js 16 · React 19 · TypeScript · TailwindCSS v4 · Prisma · Vercel Postgres
**Prerequisite:** US-01–US-16 code already in place (`lib/calculations.ts`, `lib/splitwise.ts`, `app/api/splitwise/*`).

---

## 1. Delta File Tree

Files marked `[NEW]` are created fresh. Files marked `[MOVE]` relocate existing files.
Files marked `[UPDATE]` are modified in-place. Unlisted existing files are untouched.

```
bestminton/
│
├── prisma/
│   └── schema.prisma                              [NEW] Prisma schema
│
├── app/
│   ├── page.tsx                                   [UPDATE] Replace SPA with match list homepage
│   ├── matches/
│   │   └── [id]/
│   │       └── page.tsx                           [NEW] Match detail page
│   ├── management/
│   │   └── page.tsx                               [NEW] Captain management page
│   └── api/
│       ├── members/
│       │   ├── route.ts                           [NEW] GET list, POST create
│       │   └── [id]/
│       │       └── route.ts                       [NEW] PUT update, DELETE remove
│       └── matches/
│           ├── route.ts                           [NEW] GET list, POST create
│           └── [id]/
│               ├── route.ts                       [NEW] GET detail, PUT update, DELETE
│               ├── register/
│               │   └── route.ts                   [NEW] POST register, DELETE unregister
│               └── guests/
│                   ├── route.ts                   [NEW] POST add guest
│                   └── [guestId]/
│                       └── route.ts               [NEW] DELETE remove guest
│
├── components/
│   ├── matches/                                   [NEW folder]
│   │   ├── MatchCard.tsx                          [NEW]
│   │   ├── MatchTabs.tsx                          [NEW]
│   │   ├── MemberRoster.tsx                       [NEW]
│   │   ├── AvatarTile.tsx                         [NEW]
│   │   ├── RegistrationRow.tsx                    [NEW]
│   │   └── SettleForm.tsx                         [NEW]
│   ├── management/                                [NEW folder]
│   │   ├── MemberForm.tsx                         [NEW]
│   │   ├── MemberCard.tsx                         [NEW]
│   │   ├── MatchForm.tsx                          [NEW]
│   │   └── MatchManageRow.tsx                     [NEW]
│   └── ui/
│       ├── Avatar.tsx                             [NEW]
│       ├── ConfirmDialog.tsx                      [NEW]
│       ├── ErrorBanner.tsx                        [KEEP]
│       └── LoadingSpinner.tsx                     [KEEP]
│
└── lib/
    ├── db.ts                                      [NEW] Prisma singleton
    ├── types.ts                                   [UPDATE] Add DTO interfaces
    └── calculations.ts                            [UPDATE] New signature for RegistrationDTO[]
```

---

## 2. Prisma Schema (`prisma/schema.prisma`)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("POSTGRES_PRISMA_URL")
  directUrl = env("POSTGRES_URL_NON_POOLING")
}

model Member {
  id           Int      @id @default(autoincrement())
  name         String
  avatarUrl    String?
  splitwiseId  Int?     @unique
  createdAt    DateTime @default(now())

  registrations MatchRegistration[]
  paidMatches   Match[]             @relation("MatchPayer")
}

model Match {
  id             Int      @id @default(autoincrement())
  title          String
  venue          String
  scheduledAt    DateTime
  hours          Float?
  totalCost      Float?
  paidByMemberId Int?
  isRecurring    Boolean  @default(false)
  recurDayOfWeek Int?
  synced         Boolean  @default(false)
  createdAt      DateTime @default(now())

  paidBy        Member?             @relation("MatchPayer", fields: [paidByMemberId], references: [id])
  registrations MatchRegistration[]
}

model MatchRegistration {
  id        Int      @id @default(autoincrement())
  matchId   Int
  memberId  Int
  joinedAt  DateTime @default(now())

  match  Match  @relation(fields: [matchId], references: [id], onDelete: Cascade)
  member Member @relation(fields: [memberId], references: [id])
  guests Guest[]

  @@unique([matchId, memberId])
}

model Guest {
  id             Int     @id @default(autoincrement())
  label          String?
  registrationId Int

  registration MatchRegistration @relation(fields: [registrationId], references: [id], onDelete: Cascade)
}
```

**Cascade rules:**
- Deleting a `Match` cascades to `MatchRegistration` → cascades to `Guest`.
- Deleting a `MatchRegistration` cascades to its `Guest` rows.
- Deleting a `Member` is **blocked** (no cascade) — handled at the API layer with a 409 guard.

---

## 3. Updated Types (`lib/types.ts` additions)

Add these interfaces alongside the existing ones. Do **not** remove any existing types.

```typescript
// ─── Database DTO shapes (returned by API routes) ─────────────────────────

export interface MemberDTO {
  id: number;
  name: string;
  avatarUrl: string | null;
  splitwiseId: number | null;
}

export interface GuestDTO {
  id: number;
  label: string | null;
}

export interface RegistrationDTO {
  id: number;
  matchId: number;
  memberId: number;
  joinedAt: string;         // ISO string
  member: MemberDTO;
  guests: GuestDTO[];
}

export interface MatchDTO {
  id: number;
  title: string;
  venue: string;
  scheduledAt: string;      // ISO string
  hours: number | null;
  totalCost: number | null;
  paidByMemberId: number | null;
  isRecurring: boolean;
  recurDayOfWeek: number | null;
  synced: boolean;
  registrations: RegistrationDTO[];
}

// ─── Calculated share (updated — uses RegistrationDTO instead of AttendanceRecord) ──

export interface CalculatedShare {
  memberId: number;
  name: string;
  guestCount: number;
  weight: number;
  owedShare: number;
}
```

---

## 4. Updated Calculations (`lib/calculations.ts`)

Replace the existing `calculateShares` function entirely. Keep `computeWeight` unchanged.

```typescript
import type { RegistrationDTO, CalculatedShare } from "./types";

export function computeWeight(hours: number, guests: number): number {
  return hours * (1 + guests);
}

export function calculateShares(
  registrations: RegistrationDTO[],
  totalCost: number,
  hours: number
): CalculatedShare[] {
  if (!registrations.length || totalCost <= 0 || hours <= 0) return [];

  const weighted = registrations.map((r) => ({
    memberId: r.memberId,
    name: r.member.name,
    guestCount: r.guests.length,
    weight: computeWeight(hours, r.guests.length),
  }));

  const totalWeight = weighted.reduce((s, p) => s + p.weight, 0);

  const shares: CalculatedShare[] = weighted.map((p) => ({
    ...p,
    owedShare: Math.round((totalCost * p.weight / totalWeight) * 100) / 100,
  }));

  // Cent-integer rounding correction (prevent Splitwise 422)
  const sumCents = shares.reduce((s, p) => s + Math.round(p.owedShare * 100), 0);
  const diffCents = Math.round(totalCost * 100) - sumCents;
  if (diffCents !== 0) {
    shares[0].owedShare =
      Math.round((shares[0].owedShare + diffCents / 100) * 100) / 100;
  }

  return shares;
}
```

---

## 5. Database Client (`lib/db.ts`)

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query"] : [],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

---

## 6. API Route Specifications

### 6.1 Members

#### `GET /api/members`
Returns all members sorted by name ascending.

```typescript
// Response: MemberDTO[]
const members = await db.member.findMany({ orderBy: { name: "asc" } });
```

#### `POST /api/members`
Validates name and optional splitwiseId. Returns 409 if splitwiseId already exists.

```typescript
// Request body: { name: string; avatarUrl?: string; splitwiseId?: number }
// Response: MemberDTO  |  { error: string } 409
```

Validation:
- `name`: required, non-empty string.
- `splitwiseId`: optional, must be a positive integer if provided.
- Catch Prisma `P2002` (unique constraint on `splitwiseId`) → return 409.

#### `PUT /api/members/[id]`
Same validation as POST. Returns 404 if member not found.

#### `DELETE /api/members/[id]`
Check `db.matchRegistration.count({ where: { memberId: id } })`.
If > 0 → return 409 `{ error: "Member has existing registrations and cannot be deleted." }`.
Otherwise → `db.member.delete(...)`.

---

### 6.2 Matches

#### `GET /api/matches`
Returns all matches with nested registrations (including member and guests).

```typescript
const matches = await db.match.findMany({
  include: {
    registrations: {
      include: { member: true, guests: true },
    },
  },
  orderBy: { scheduledAt: "asc" },
});
```

#### `POST /api/matches`
Body: `{ title, venue, scheduledAt, isRecurring?, recurDayOfWeek? }`

**Single match** (`isRecurring = false`):
- Create one `Match` row.
- Return `MatchDTO[]` (array of 1).

**Recurring match** (`isRecurring = true`):
- Generate 4 occurrences: `scheduledAt`, `scheduledAt + 7d`, `+14d`, `+21d`.
- `recurDayOfWeek` is derived from `new Date(scheduledAt).getDay()`.
- Create all 4 in a `db.$transaction([...])`.
- Return `MatchDTO[]` (array of 4).

Validation:
- All fields required.
- `scheduledAt` must be a valid ISO date string.

#### `GET /api/matches/[id]`
Same include as `GET /api/matches` but for one record. Returns 404 if not found.

#### `PUT /api/matches/[id]`
Accepts partial update: any combination of `{ title?, venue?, scheduledAt?, hours?, totalCost?, paidByMemberId? }`.
Returns 404 if not found.
Returns 422 if `synced = true` (settled matches cannot have settlement fields overwritten — only `title`/`venue`/`scheduledAt` can be edited post-sync).

#### `DELETE /api/matches/[id]`
If `match.synced = true`, require body `{ confirmSynced: true }` or return 409 with message "This match has been synced to Splitwise. Pass `confirmSynced: true` to delete anyway."
Otherwise delete (cascade handles registrations/guests).

---

### 6.3 Registration

#### `POST /api/matches/[id]/register`
Body: `{ memberId: number }`

- Verify match exists and is in the future (if past → 400 `"Registration is closed for past matches."`).
- `db.matchRegistration.upsert({ where: { matchId_memberId }, create: ..., update: {} })`.
- Return full `RegistrationDTO` with member and guests.

#### `DELETE /api/matches/[id]/register`
Body: `{ memberId: number }`

- `db.matchRegistration.delete({ where: { matchId_memberId } })`.
- Return `{ success: true }`.

---

### 6.4 Guests

#### `POST /api/matches/[id]/guests`
Body: `{ memberId: number; label?: string }`

- Find registration: `db.matchRegistration.findUniqueOrThrow({ where: { matchId_memberId } })`.
- `db.guest.create({ data: { registrationId: reg.id, label } })`.
- Return `GuestDTO`.

#### `DELETE /api/matches/[id]/guests/[guestId]`
- `db.guest.delete({ where: { id: guestId } })`.
- Return `{ success: true }`.

---

### 6.5 Updated Splitwise Expense Route

`POST /api/splitwise/expense` — update the existing route to handle match-based data:

**Expected client body:**
```typescript
{
  matchId: number;          // to mark match.synced = true on success
  totalCost: number;
  description: string;
  groupId: number;          // 0 — resolved server-side from env
  paidById: number;         // Splitwise user ID (not DB member ID)
  participants: Array<{
    userId: number;         // Splitwise user ID
    owedShare: number;
  }>;
}
```

**Server-side logic:**
1. Check `isSplitwiseConfigured()` → 503 if not.
2. Validate body fields.
3. Rounding invariant check (sum of `owedShare` must equal `totalCost` in cents).
4. Build flat payload with `buildSplitwisePayload()`.
5. POST to Splitwise.
6. On success → `db.match.update({ where: { id: matchId }, data: { synced: true } })`.
7. Return `{ success: true, expenseId }`.

---

## 7. Shared UI Components

### 7.1 `Avatar` (`components/ui/Avatar.tsx`)

```typescript
// Props
interface AvatarProps {
  name: string;
  avatarUrl: string | null;
  size?: "sm" | "md" | "lg"; // sm=32px, md=48px, lg=64px
  className?: string;
}
```

Renders `<img>` if `avatarUrl` is set; otherwise renders a circle with the member's initials (first letter of each word in name, max 2 letters) on a deterministic background colour derived from the name.

### 7.2 `ConfirmDialog` (`components/ui/ConfirmDialog.tsx`)

```typescript
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;   // default: "Delete"
  onConfirm: () => void;
  onCancel: () => void;
}
```

Simple modal overlay. No third-party library — built with Tailwind. Clicking the backdrop calls `onCancel`.

---

## 8. Match-Specific Components

### 8.1 `MatchCard` (`components/matches/MatchCard.tsx`)

**Props:** `match: MatchDTO`

**Renders:**
- Title + optional "↻ Weekly" badge (`isRecurring = true`).
- Venue with map-pin icon.
- Formatted date + time.
- Player count badge: `N players`.
- "Synced ✓" badge if `match.synced`.
- Entire card is a `<Link href={/matches/${match.id}}>`.

**No client state** — pure presentational Server-safe component.

---

### 8.2 `MatchTabs` (`components/matches/MatchTabs.tsx`)

**Client component.**

**Props:** `upcoming: MatchDTO[]`, `past: MatchDTO[]`

**Behaviour:**
- Read `searchParams.get("tab")` via `useSearchParams()` — default `"upcoming"`.
- Two tab buttons: clicking updates the URL with `router.replace("/?tab=past")`.
- Renders `<MatchCard>` list for the active tab.
- Empty state per tab: "No upcoming matches scheduled." / "No past matches yet."

---

### 8.3 `MemberRoster` (`components/matches/MemberRoster.tsx`)

**Client component.**

**Props:**
```typescript
interface MemberRosterProps {
  matchId: number;
  allMembers: MemberDTO[];
  registrations: RegistrationDTO[];
  isPast: boolean;
}
```

**State:** `registrations` as local state, initialized from props (for optimistic updates).

**Behaviour:**
- Renders a responsive grid of `<AvatarTile>` for every member.
- Registered members (by `memberId`) show a checked/highlighted state.
- Tapping an `AvatarTile`:
  - If `isPast` → no-op.
  - If registered → optimistic remove from local state → `DELETE /api/matches/[id]/register` → revert on error.
  - If not registered → optimistic add to local state → `POST /api/matches/[id]/register` → revert on error + show error banner.

---

### 8.4 `AvatarTile` (`components/matches/AvatarTile.tsx`)

**Client component.**

**Props:**
```typescript
interface AvatarTileProps {
  member: MemberDTO;
  registered: boolean;
  disabled: boolean;
  onToggle: () => void;
}
```

**Renders:**
- `<Avatar size="lg">` with a checkmark overlay (absolute, emerald) when `registered = true`.
- Member name below.
- Green border ring when registered.
- `disabled` state (past match): opacity-50, cursor-default.

---

### 8.5 `RegistrationRow` (`components/matches/RegistrationRow.tsx`)

**Client component.**

**Props:**
```typescript
interface RegistrationRowProps {
  registration: RegistrationDTO;
  matchId: number;
  isPast: boolean;
  onGuestsChange: (updated: RegistrationDTO) => void;
}
```

**Renders:**
- `<Avatar size="sm">` + member name.
- Guest chips: small badge per guest with optional label and ✕ button.
- "+ Guest" button → `POST /api/matches/[id]/guests` → optimistic add.
- ✕ on guest → `DELETE /api/matches/[id]/guests/[guestId]` → optimistic remove.
- All controls disabled when `isPast`.

---

### 8.6 `SettleForm` (`components/matches/SettleForm.tsx`)

**Client component.** Only rendered for past matches.

**Props:**
```typescript
interface SettleFormProps {
  match: MatchDTO;
  registrations: RegistrationDTO[];   // live state (may have changed after guest edits)
}
```

**Internal state:**
- `totalCost: number | ""` — pre-filled from `match.totalCost`.
- `paidByMemberId: number | null` — pre-filled from `match.paidByMemberId`.
- `hours: number | ""` — pre-filled from `match.hours`.
- `saving: boolean`, `saveError: string | null`.
- `shares: CalculatedShare[]` — recomputed whenever totalCost / hours / registrations change.
- `syncStatus: "idle" | "syncing" | "success" | "error"`, `syncError: string | null`.

**Save flow:**
1. Validate: cost > 0, hours > 0, paidBy selected.
2. `PUT /api/matches/[id]` with `{ totalCost, hours, paidByMemberId }`.
3. On success → recompute shares from current registrations.

**Share table:**
- Columns: Name | Guests | Weight | Owes (฿)
- Footer: Total | — | — | `totalCost`

**Sync button block** (shown below share table once shares are computed):
- Disabled if `!isSplitwiseConfigured` (shows amber info notice).
- Disabled if any registration's `member.splitwiseId` is null (shows warning with list of names).
- Disabled if `match.synced` (shows "Synced ✓" badge).
- On click → `POST /api/splitwise/expense` with calculated shares mapped to Splitwise user IDs.
- On success → update local `match.synced` state.

---

## 9. Management Components

### 9.1 `MemberForm` (`components/management/MemberForm.tsx`)

**Client component.**

**Props:**
```typescript
interface MemberFormProps {
  initial?: MemberDTO;        // undefined = create mode, defined = edit mode
  onSaved: (m: MemberDTO) => void;
  onCancel?: () => void;
}
```

**Fields:** Name (text, required), Avatar URL (text, optional), Splitwise ID (number, optional).

**Validation:**
- Name: non-empty string.
- Splitwise ID: positive integer if provided.

**Submit:** `POST /api/members` (create) or `PUT /api/members/[id]` (edit).
On success → call `onSaved(result)`.

---

### 9.2 `MemberCard` (`components/management/MemberCard.tsx`)

**Client component.**

**Props:** `member: MemberDTO`, `onUpdated(m: MemberDTO): void`, `onDeleted(id: number): void`

**States:** view / editing / deleting (confirm dialog).

**Renders:**
- View: `<Avatar>` + name + Splitwise ID badge (or "No Splitwise ID") + Edit + Delete buttons.
- Editing: inline `<MemberForm initial={member}>`.
- Delete: `<ConfirmDialog>` → `DELETE /api/members/[id]` → on 409 show error banner, on success call `onDeleted`.

---

### 9.3 `MatchForm` (`components/management/MatchForm.tsx`)

**Client component.**

**Props:**
```typescript
interface MatchFormProps {
  initial?: MatchDTO;
  onSaved: (matches: MatchDTO[]) => void;
  onCancel?: () => void;
}
```

**Fields:**
- Title (text, required).
- Venue (text, required).
- Date (date input, required, must be ≥ today).
- Time (time input, required).
- Recurring toggle (checkbox).
- When recurring = on: show label "Will repeat every `<dayName>`" derived from chosen date.

**Submit:**
- `POST /api/matches` (create, returns array of 1 or 4).
- `PUT /api/matches/[id]` (edit, returns single MatchDTO wrapped in array `[dto]`).
- On success → call `onSaved(result)`.

---

### 9.4 `MatchManageRow` (`components/management/MatchManageRow.tsx`)

**Client component.**

**Props:** `match: MatchDTO`, `onUpdated(m: MatchDTO): void`, `onDeleted(id: number): void`

**States:** view / editing / deleting.

**Renders:**
- View: title, venue, formatted date, recurring badge, synced badge, player count, Edit + Delete buttons.
- Editing: inline `<MatchForm initial={match}>`.
- Delete: `<ConfirmDialog>`. If `match.synced`, show extra warning "This match has been synced to Splitwise." API called with `{ confirmSynced: true }` in body.

---

## 10. Pages

### 10.1 Homepage (`app/page.tsx`)

```typescript
// Server Component
import { db } from "@/lib/db";
import MatchTabs from "@/components/matches/MatchTabs";

export default async function HomePage() {
  const matches = await db.match.findMany({
    include: { registrations: { include: { member: true, guests: true } } },
    orderBy: { scheduledAt: "asc" },
  });

  const now = new Date();
  const upcoming = matches.filter(m => new Date(m.scheduledAt) >= now);
  const past = matches
    .filter(m => new Date(m.scheduledAt) < now)
    .reverse(); // most recent first

  return (
    <div>
      <Header />
      <MatchTabs upcoming={upcoming} past={past} />
    </div>
  );
}
```

**No `use client`** — data is fetched server-side. Only `MatchTabs` is a client component.

---

### 10.2 Match Detail (`app/matches/[id]/page.tsx`)

```typescript
// Server Component
import { notFound } from "next/navigation";
import { db } from "@/lib/db";

export default async function MatchPage({ params }: { params: { id: string } }) {
  const matchId = parseInt(params.id);
  const [match, allMembers] = await Promise.all([
    db.match.findUnique({
      where: { id: matchId },
      include: { registrations: { include: { member: true, guests: true } } },
    }),
    db.member.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!match) notFound();

  const isPast = new Date(match.scheduledAt) < new Date();

  return (
    <div>
      <MatchHeader match={match} />
      <MemberRoster
        matchId={match.id}
        allMembers={allMembers}
        registrations={match.registrations}
        isPast={isPast}
      />
      <RegistrationList
        matchId={match.id}
        registrations={match.registrations}
        isPast={isPast}
      />
      {isPast && <SettleForm match={match} registrations={match.registrations} />}
    </div>
  );
}
```

**`RegistrationList`** is a thin client wrapper that holds registration state and renders `<RegistrationRow>` per registration, passing `onGuestsChange` callbacks.

**The `isPast` flag is the sole gate** for showing `SettleForm` and disabling registration.

---

### 10.3 Management (`app/management/page.tsx`)

```typescript
// Server Component
import { db } from "@/lib/db";

export default async function ManagementPage() {
  const [members, matches] = await Promise.all([
    db.member.findMany({ orderBy: { name: "asc" } }),
    db.match.findMany({
      include: { registrations: { include: { member: true, guests: true } } },
      orderBy: { scheduledAt: "desc" },
    }),
  ]);

  return (
    <div>
      <Header />
      <MembersSection initialMembers={members} />
      <MatchesSection initialMatches={matches} />
    </div>
  );
}
```

**`MembersSection`** and **`MatchesSection`** are client components that own their local list state (add/update/delete without page reload via optimistic updates to the array).

---

## 11. State Management Pattern

All management-page client components use a **local array state + server sync** pattern — no global store needed.

```typescript
// Example pattern for MembersSection
const [members, setMembers] = useState<MemberDTO[]>(initialMembers);

function handleSaved(m: MemberDTO) {
  setMembers(prev => {
    const exists = prev.find(x => x.id === m.id);
    return exists ? prev.map(x => x.id === m.id ? m : x) : [...prev, m];
  });
}

function handleDeleted(id: number) {
  setMembers(prev => prev.filter(m => m.id !== id));
}
```

The same pattern applies to `MatchesSection` and to `MemberRoster` for registration toggling.

---

## 12. Serialisation Note

Prisma `DateTime` fields are `Date` objects in Node.js but must be JSON-serialised as ISO strings to cross the Server→Client boundary. In every API route, call `JSON.parse(JSON.stringify(record))` or use a `.toISOString()` mapper before returning `NextResponse.json(...)`.

In `MatchDTO`, `scheduledAt`, `joinedAt`, and `createdAt` are typed as `string` (ISO) for this reason.

---

## 13. Implementation Steps

### Step 1 — Prisma & Database Setup

```bash
npm install prisma @prisma/client
npx prisma init --datasource-provider postgresql
```

1. Write `prisma/schema.prisma` (§2).
2. Add Vercel Postgres env vars to `.env.local`.
3. `npx prisma migrate dev --name init` — creates tables and generates client.
4. Write `lib/db.ts` singleton (§5).

**Verify:** `npx prisma studio` — confirm all 4 tables exist.

**Covers:** foundation for all US-17–28.

---

### Step 2 — Updated Types & Calculations

1. Add `MemberDTO`, `GuestDTO`, `RegistrationDTO`, `MatchDTO`, `CalculatedShare` to `lib/types.ts`.
2. Replace `calculateShares` in `lib/calculations.ts` with the new signature (§4).
3. Confirm TypeScript still passes: `npx tsc --noEmit`.

**Covers:** US-07, US-08 (unchanged logic, new input shape).

---

### Step 3 — Member API Routes

1. Create `app/api/members/route.ts` — `GET` + `POST`.
2. Create `app/api/members/[id]/route.ts` — `PUT` + `DELETE` (with 409 registration guard).

**Test with curl:**
```bash
# Create
curl -X POST /api/members -d '{"name":"Alice"}' -H "Content-Type: application/json"
# Delete with registrations → expect 409
```

**Covers:** US-21, US-24.

---

### Step 4 — Match API Routes

1. Create `app/api/matches/route.ts` — `GET` (with full includes) + `POST` (recurring logic).
2. Create `app/api/matches/[id]/route.ts` — `GET`, `PUT` (settlement fields), `DELETE` (synced guard).

**Recurring generation helper (inline in route):**
```typescript
function generateOccurrences(base: Date, count: number): Date[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(base);
    d.setDate(d.getDate() + i * 7);
    return d;
  });
}
```

**Test:** Create recurring match → verify 4 rows in DB.

**Covers:** US-22, US-23, US-25, US-27.

---

### Step 5 — Registration & Guest API Routes

1. Create `app/api/matches/[id]/register/route.ts` — `POST` (upsert with past-match guard) + `DELETE`.
2. Create `app/api/matches/[id]/guests/route.ts` — `POST`.
3. Create `app/api/matches/[id]/guests/[guestId]/route.ts` — `DELETE`.

**Covers:** US-19, US-20.

---

### Step 6 — Shared UI Components

1. Write `components/ui/Avatar.tsx` — initials fallback with deterministic colour.
2. Write `components/ui/ConfirmDialog.tsx` — modal overlay.

**Colour derivation for Avatar:**
```typescript
const COLOURS = ["bg-emerald-500","bg-blue-500","bg-violet-500","bg-orange-500","bg-pink-500"];
function colourFor(name: string) {
  const idx = name.charCodeAt(0) % COLOURS.length;
  return COLOURS[idx];
}
```

**Covers:** shared foundation for US-19, US-21, US-24.

---

### Step 7 — Homepage

1. Rewrite `app/page.tsx` as a Server Component (fetch + split into upcoming/past).
2. Write `components/matches/MatchCard.tsx`.
3. Write `components/matches/MatchTabs.tsx` (Client — `useSearchParams`, `useRouter`).

**URL tab state:**
```typescript
// MatchTabs.tsx
const searchParams = useSearchParams();
const router = useRouter();
const activeTab = searchParams.get("tab") ?? "upcoming";

function switchTab(tab: string) {
  router.replace(`/?tab=${tab}`, { scroll: false });
}
```

**Covers:** US-17, US-18.

---

### Step 8 — Match Detail Page

Build in this order (each depends on the previous):

1. `components/matches/AvatarTile.tsx` — tappable avatar tile.
2. `components/matches/MemberRoster.tsx` — avatar grid with optimistic registration toggle.
3. `components/matches/RegistrationRow.tsx` — registered player row with guest management.
4. `RegistrationList` (inline client wrapper in `app/matches/[id]/page.tsx`) — holds registration state, renders rows.
5. `components/matches/SettleForm.tsx` — cost/hours form + share table + sync button.
6. `app/matches/[id]/page.tsx` — Server Component assembling all of the above.

**Optimistic toggle in `MemberRoster`:**
```typescript
async function handleToggle(member: MemberDTO) {
  const isRegistered = registrations.some(r => r.memberId === member.id);
  // Optimistic update
  setRegistrations(prev =>
    isRegistered
      ? prev.filter(r => r.memberId !== member.id)
      : [...prev, buildOptimisticRegistration(member)]
  );
  try {
    if (isRegistered) {
      await fetch(`/api/matches/${matchId}/register`, {
        method: "DELETE", body: JSON.stringify({ memberId: member.id }),
        headers: { "Content-Type": "application/json" },
      });
    } else {
      const res = await fetch(`/api/matches/${matchId}/register`, {
        method: "POST", body: JSON.stringify({ memberId: member.id }),
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      // Replace optimistic with real registration (has real ID)
      setRegistrations(prev =>
        prev.map(r => r.memberId === member.id ? data : r)
      );
    }
  } catch {
    // Revert
    setRegistrations(original);
    setError("Registration failed. Please try again.");
  }
}
```

**Covers:** US-19, US-20, US-26, US-27, US-28.

---

### Step 9 — Management Page

1. Write `components/management/MemberForm.tsx`.
2. Write `components/management/MemberCard.tsx`.
3. Write `MembersSection` (client, inline in management page or extracted).
4. Write `components/management/MatchForm.tsx` — recurring toggle derives day label.
5. Write `components/management/MatchManageRow.tsx`.
6. Write `MatchesSection` (client).
7. Write `app/management/page.tsx` — Server Component, passes initial data.

**Day-of-week label in `MatchForm`:**
```typescript
const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const dayName = dateValue ? DAY_NAMES[new Date(dateValue).getDay()] : "";
// Renders: "Will repeat every Tuesday"
```

**Covers:** US-21, US-22, US-23, US-24, US-25.

---

### Step 10 — Updated Splitwise Expense Route

1. Update `app/api/splitwise/expense/route.ts`:
   - Accept `matchId` in the request body.
   - After successful Splitwise call → `db.match.update({ where: { id: matchId }, data: { synced: true } })`.
2. Verify rounding invariant still holds with new `CalculatedShare` shape.

**Covers:** US-28.

---

### Step 11 — Navigation & Layout

1. Update `app/layout.tsx` — add a persistent nav bar with links to `/` and `/management`.
2. Mark `/management` with a wrench icon; mark `/` with a home icon.

---

### Step 12 — End-to-End Validation

Work through the full happy path manually in the browser:

1. `/management` → Add 3 members → Create 1 upcoming match → Create 1 recurring match (4 rows).
2. `/` → Verify Upcoming tab shows all matches with correct badges.
3. `/matches/[id]` → Tap 3 avatars to register → Add 1 guest to one member.
4. Wind the `scheduledAt` back in the DB (or test with a past match directly) → verify Settle section appears.
5. Enter cost + hours → verify share table sums to total.
6. Sync to Splitwise → verify `synced = true` in DB and badge appears.

**Edge cases to confirm:**
- US-12 / US-16: single player → owedShare = totalCost.
- US-28: player without `splitwiseId` → sync button disabled with warning.
- US-23: recurring match → exactly 4 rows in `GET /api/matches`.
- US-24: delete member with registrations → 409 error shown.

---

## 14. User Story → Step Cross-reference

| US | Step(s) |
|---|---|
| US-17 | 7 |
| US-18 | 7 |
| US-19 | 5, 8 |
| US-20 | 5, 8 |
| US-21 | 3, 9 |
| US-22 | 4, 9 |
| US-23 | 4, 9 |
| US-24 | 3, 9 |
| US-25 | 4, 9 |
| US-26 | 8, 11 |
| US-27 | 4, 8 |
| US-28 | 8, 10 |
