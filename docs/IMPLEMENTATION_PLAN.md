# Implementation Plan — Bestminton (v2)

**Source:** US-01 – US-28 (see `docs/`) + `CLAUDE.md`
**Stack:** Next.js 16 · React 19 · TypeScript · TailwindCSS v4 · Prisma · Vercel Postgres

---

## 1. File Tree

```
bestminton/
├── prisma/
│   └── schema.prisma                         # DB schema — Member, Match, MatchRegistration, Guest
│
├── app/
│   ├── api/
│   │   ├── members/
│   │   │   ├── route.ts                      # GET list, POST create
│   │   │   └── [id]/
│   │   │       └── route.ts                  # PUT update, DELETE remove
│   │   ├── matches/
│   │   │   ├── route.ts                      # GET list, POST create
│   │   │   └── [id]/
│   │   │       ├── route.ts                  # GET detail, PUT update, DELETE remove
│   │   │       ├── register/
│   │   │       │   └── route.ts              # POST register, DELETE unregister
│   │   │       └── guests/
│   │   │           ├── route.ts              # POST add guest
│   │   │           └── [guestId]/
│   │   │               └── route.ts          # DELETE remove guest
│   │   └── splitwise/
│   │       ├── members/route.ts              # GET Splitwise group members (proxy)
│   │       └── expense/route.ts              # POST create Splitwise expense (proxy)
│   │
│   ├── matches/
│   │   └── [id]/
│   │       └── page.tsx                      # Match detail — registration + settlement
│   ├── management/
│   │   └── page.tsx                          # Admin — member list + match list + forms
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                              # Homepage — upcoming/past match tabs
│
├── components/
│   ├── matches/
│   │   ├── MatchCard.tsx                     # Card shown on homepage
│   │   ├── MatchTabs.tsx                     # Upcoming / Past tab switcher
│   │   ├── MemberRoster.tsx                  # Avatar grid for self-registration
│   │   ├── AvatarTile.tsx                    # Single tappable avatar
│   │   ├── RegistrationRow.tsx               # Registered player row + guest controls
│   │   └── SettleForm.tsx                    # Cost / hours / payer entry form
│   ├── management/
│   │   ├── MemberForm.tsx                    # Add / edit member
│   │   ├── MemberCard.tsx                    # Member list item (edit + delete)
│   │   ├── MatchForm.tsx                     # Create / edit match (recurring toggle)
│   │   └── MatchManageRow.tsx                # Match list item (edit + delete)
│   └── ui/
│       ├── Avatar.tsx                        # Avatar with fallback initials
│       ├── ErrorBanner.tsx
│       ├── LoadingSpinner.tsx
│       ├── SyncButton.tsx                    # Sync + status states
│       └── Tabs.tsx                          # Generic tab component
│
├── lib/
│   ├── calculations.ts                       # Weight + share math + rounding fix
│   ├── db.ts                                 # Prisma client singleton
│   ├── splitwise.ts                          # Server-side Splitwise fetch helper
│   └── types.ts                              # Shared TypeScript interfaces
│
├── .env.local
├── next.config.ts
└── tsconfig.json
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
  id              Int      @id @default(autoincrement())
  title           String
  venue           String
  scheduledAt     DateTime
  hours           Float?
  totalCost       Float?
  paidByMemberId  Int?
  isRecurring     Boolean  @default(false)
  recurDayOfWeek  Int?
  synced          Boolean  @default(false)
  createdAt       DateTime @default(now())

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
  id             Int      @id @default(autoincrement())
  label          String?
  registrationId Int

  registration MatchRegistration @relation(fields: [registrationId], references: [id], onDelete: Cascade)
}
```

---

## 3. Core Types (`lib/types.ts`)

```typescript
// Prisma-shaped response types returned from API routes

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
  memberId: number;
  member: MemberDTO;
  guests: GuestDTO[];
}

export interface MatchDTO {
  id: number;
  title: string;
  venue: string;
  scheduledAt: string;           // ISO string (serialised from DateTime)
  hours: number | null;
  totalCost: number | null;
  paidByMemberId: number | null;
  isRecurring: boolean;
  recurDayOfWeek: number | null;
  synced: boolean;
  registrations: RegistrationDTO[];
}

// Calculation types (unchanged from v1)

export interface CalculatedShare {
  memberId: number;
  name: string;
  guestCount: number;
  weight: number;
  owedShare: number;
}

export interface CreateExpenseRequest {
  totalCost: number;
  description: string;
  groupId: number;
  paidById: number;
  participants: Array<{ userId: number; owedShare: number }>;
}

export type SplitwiseFlatPayload = Record<string, string | number | boolean>;
```

---

## 4. Calculation Logic (`lib/calculations.ts`)

Unchanged from v1 — `computeWeight(hours, guests)` and `calculateShares(registrations, totalCost)`.

The function signature changes slightly to accept `RegistrationDTO[]` instead of the old `AttendanceRecord[]`:

```typescript
export function calculateShares(
  registrations: RegistrationDTO[],
  totalCost: number,
  hours: number
): CalculatedShare[] {
  const participants = registrations.map((r) => ({
    memberId: r.memberId,
    name: r.member.name,
    guestCount: r.guests.length,
    weight: computeWeight(hours, r.guests.length),
  }));

  const totalWeight = participants.reduce((s, p) => s + p.weight, 0);

  const shares = participants.map((p) => ({
    ...p,
    owedShare: Math.round((totalCost * p.weight / totalWeight) * 100) / 100,
  }));

  // Cent-integer rounding correction on index 0
  const diffCents =
    Math.round(totalCost * 100) -
    shares.reduce((s, p) => s + Math.round(p.owedShare * 100), 0);
  if (diffCents !== 0) {
    shares[0].owedShare = Math.round((shares[0].owedShare + diffCents / 100) * 100) / 100;
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
  new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["query"] : [] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

---

## 6. API Route Specifications

### 6.1 Members

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/members` | — | `MemberDTO[]` |
| POST | `/api/members` | `{ name, avatarUrl?, splitwiseId? }` | `MemberDTO` |
| PUT | `/api/members/[id]` | same as POST | `MemberDTO` |
| DELETE | `/api/members/[id]` | — | `{ success: true }` or 409 |

**DELETE guard:** If the member has any `MatchRegistration` rows, return 409.

---

### 6.2 Matches

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/matches` | — | `MatchDTO[]` (with registrations) |
| POST | `/api/matches` | `{ title, venue, scheduledAt, isRecurring?, recurDayOfWeek? }` | `MatchDTO[]` (1 or N for recurring) |
| GET | `/api/matches/[id]` | — | `MatchDTO` |
| PUT | `/api/matches/[id]` | Partial match fields | `MatchDTO` |
| DELETE | `/api/matches/[id]` | — | `{ success: true }` |

**Recurring match creation:** When `isRecurring = true`, generate 4 weekly occurrences. Each is a separate row; `isRecurring` and `recurDayOfWeek` are stored on each row so they are identifiable.

---

### 6.3 Registration

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/matches/[id]/register` | `{ memberId }` | `RegistrationDTO` |
| DELETE | `/api/matches/[id]/register` | `{ memberId }` | `{ success: true }` |

---

### 6.4 Guests

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/matches/[id]/guests` | `{ memberId, label? }` | `GuestDTO` |
| DELETE | `/api/matches/[id]/guests/[guestId]` | — | `{ success: true }` |

---

### 6.5 Splitwise (unchanged from v1)

- `GET /api/splitwise/members` — proxy to Splitwise group members
- `POST /api/splitwise/expense` — builds flat payload, forwards to Splitwise

Both return 503 if env vars are missing.

---

## 7. Key UI Components

### 7.1 `MatchCard` (homepage)
Props: `match: MatchDTO`
Shows title, venue, formatted date/time, player count badge, recurring badge, "Synced" badge for past matches.
Links to `/matches/[id]`.

### 7.2 `MatchTabs` (homepage)
Client component. Reads `?tab=` from the URL and renders the correct subset of matches.
Tabs: "Upcoming" | "Past".

### 7.3 `MemberRoster` (`/matches/[id]`)
Client component.
Shows all `Member` rows as `AvatarTile` grid.
Tiles for registered members are highlighted; tapping toggles registration.

### 7.4 `AvatarTile`
Props: `member: MemberDTO`, `registered: boolean`, `onToggle(): void`
Renders avatar image (or initials fallback), name below, checkmark overlay when registered.
Calls `POST` or `DELETE /api/matches/[id]/register` on tap.

### 7.5 `RegistrationRow`
Props: `registration: RegistrationDTO`, `matchId: number`
Shows member avatar + name, guest count, "+ Guest" button, and per-guest remove buttons.

### 7.6 `SettleForm` (`/matches/[id]`, past matches only)
Props: `match: MatchDTO`, `registrations: RegistrationDTO[]`
Fields: Total Cost, Paid By (dropdown of registered members), Hours Played.
On save → `PUT /api/matches/[id]`.
Derives and displays `CalculatedShare[]` table below.
Shows `SyncButton` once cost + hours are set.

### 7.7 `MemberForm` (`/management`)
Add or edit a member. Name, Avatar URL, Splitwise ID fields.
On submit → `POST /api/members` or `PUT /api/members/[id]`.

### 7.8 `MatchForm` (`/management`)
Create or edit a match. Title, Venue, Date, Time, Recurring toggle.
When recurring is on, day-of-week label appears ("Will repeat every Tuesday").
On submit → `POST /api/matches` or `PUT /api/matches/[id]`.

---

## 8. Page Architecture

### 8.1 Homepage (`app/page.tsx`)
**Server Component** — fetches all matches from DB via Prisma, passes them as props to `MatchTabs` (Client Component for tab interaction).

```
HomePage (Server)
└── MatchTabs (Client) — reads ?tab param
    ├── [Upcoming] → MatchCard list
    └── [Past]     → MatchCard list
```

### 8.2 Match Detail (`app/matches/[id]/page.tsx`)
**Server Component** — fetches match + registrations + all members. Renders:
- Match header (title, venue, datetime)
- `MemberRoster` (Client) — for self-registration
- `RegistrationRow` list (Client) — shows registrations + guest controls
- `SettleForm` (Client, past matches only) — cost entry + sync

### 8.3 Management (`app/management/page.tsx`)
**Server Component** — fetches all members and matches. Renders two sections:
- Members: `MemberCard` list + `MemberForm`
- Matches: `MatchManageRow` list + `MatchForm`

---

## 9. Environment Variables (`.env.local`)

```bash
# Vercel Postgres (required)
POSTGRES_URL=
POSTGRES_PRISMA_URL=
POSTGRES_URL_NON_POOLING=

# Splitwise (optional — only needed to sync expenses)
SPLITWISE_API_KEY=
SPLITWISE_GROUP_ID=
```

---

## 10. Implementation Steps

### Step 1 — Prisma Setup

1. `npm install prisma @prisma/client`
2. `npx prisma init --datasource-provider postgresql`
3. Write `prisma/schema.prisma` (see §2).
4. Add Vercel Postgres env vars to `.env.local`.
5. `npx prisma migrate dev --name init` to create tables.
6. Write `lib/db.ts` singleton.

**Covers:** database foundation for all epics.

---

### Step 2 — Member API Routes

**Files:** `app/api/members/route.ts`, `app/api/members/[id]/route.ts`

1. `GET /api/members` → `db.member.findMany({ orderBy: { name: 'asc' } })`.
2. `POST /api/members` → validate name, create member.
3. `PUT /api/members/[id]` → update fields.
4. `DELETE /api/members/[id]` → check for registrations first (409 guard), then delete.

**Covers:** US-21, US-24.

---

### Step 3 — Match API Routes

**Files:** `app/api/matches/route.ts`, `app/api/matches/[id]/route.ts`

1. `GET /api/matches` → `db.match.findMany` with `registrations.member` and `registrations.guests` included.
2. `POST /api/matches` → create 1 match (or 4 weekly occurrences if `isRecurring`).
3. `PUT /api/matches/[id]` → update cost/hours/paidBy (settlement fields) or title/venue (edit).
4. `DELETE /api/matches/[id]` → cascade deletes registrations and guests.

**Covers:** US-22, US-23, US-25, US-27.

---

### Step 4 — Registration & Guest API Routes

**Files:** `app/api/matches/[id]/register/route.ts`, `app/api/matches/[id]/guests/route.ts`, `app/api/matches/[id]/guests/[guestId]/route.ts`

1. `POST /api/matches/[id]/register` → upsert `MatchRegistration`.
2. `DELETE /api/matches/[id]/register` → delete registration (cascades guests).
3. `POST /api/matches/[id]/guests` → find registration by `memberId`, create `Guest`.
4. `DELETE /api/matches/[id]/guests/[guestId]` → delete guest.

**Covers:** US-19, US-20.

---

### Step 5 — Homepage

**Files:** `app/page.tsx`, `components/matches/MatchTabs.tsx`, `components/matches/MatchCard.tsx`

1. `app/page.tsx` (Server) → fetch matches sorted by `scheduledAt`.
2. `MatchTabs` (Client) → read `?tab` from `useSearchParams`, filter matches by past/upcoming, render `MatchCard` list.
3. `MatchCard` → display match info, link to `/matches/[id]`.

**Covers:** US-17, US-18.

---

### Step 6 — Match Detail Page

**Files:** `app/matches/[id]/page.tsx`, `components/matches/MemberRoster.tsx`, `components/matches/AvatarTile.tsx`, `components/matches/RegistrationRow.tsx`, `components/matches/SettleForm.tsx`

1. Server page → fetch match with all relations + full member list.
2. `MemberRoster` (Client) → avatar grid with toggle registration on tap.
3. `RegistrationRow` (Client) → show per-player guests + add/remove guest buttons.
4. `SettleForm` (Client, past matches only) → cost/hours/payer form + calculated share table + `SyncButton`.

**Covers:** US-19, US-20, US-26, US-27, US-28.

---

### Step 7 — Management Page

**Files:** `app/management/page.tsx`, `components/management/MemberForm.tsx`, `components/management/MemberCard.tsx`, `components/management/MatchForm.tsx`, `components/management/MatchManageRow.tsx`

1. Server page → fetch all members and matches.
2. `MemberForm` → add/edit member; inline validation.
3. `MemberCard` → member row with edit/delete; delete shows confirm dialog.
4. `MatchForm` → create/edit match; recurring toggle derives day-of-week label.
5. `MatchManageRow` → match row with edit/delete; "Synced ✓" badge for synced matches.

**Covers:** US-21, US-22, US-23, US-24, US-25.

---

### Step 8 — Splitwise Sync (updated)

**Files:** `app/api/splitwise/expense/route.ts` (update), `lib/calculations.ts` (update signature)

1. Update `calculateShares` to accept `RegistrationDTO[]` + `hours`.
2. Sync route validates that all present members have `splitwiseId` set; returns 422 with a list of members missing IDs if not.
3. Match is updated to `synced = true` on success.

**Covers:** US-28.

---

## 11. User Story → File Cross-reference

| US | Files |
|---|---|
| US-01 | `components/matches/SettleForm.tsx` |
| US-02 | `components/matches/SettleForm.tsx` |
| US-03 | `app/api/splitwise/members/route.ts`, `app/management/page.tsx` |
| US-04 | `components/matches/MemberRoster.tsx`, `app/api/matches/[id]/register/route.ts` |
| US-05 | `components/matches/SettleForm.tsx` |
| US-06 | `components/matches/RegistrationRow.tsx`, `app/api/matches/[id]/guests/route.ts` |
| US-07 | `lib/calculations.ts`, `components/matches/SettleForm.tsx` |
| US-08 | `lib/calculations.ts` |
| US-09 | `components/matches/SettleForm.tsx` |
| US-10 | `app/api/splitwise/expense/route.ts`, `components/ui/SyncButton.tsx` |
| US-11 | `app/api/splitwise/expense/route.ts` |
| US-12 | `components/matches/SettleForm.tsx` |
| US-13 | `components/ui/SyncButton.tsx`, `components/ui/ErrorBanner.tsx` |
| US-14 | `components/ui/ErrorBanner.tsx` |
| US-15 | `components/ui/SyncButton.tsx` |
| US-16 | `lib/calculations.ts` |
| US-17 | `app/page.tsx`, `components/matches/MatchCard.tsx` |
| US-18 | `app/page.tsx`, `components/matches/MatchTabs.tsx` |
| US-19 | `components/matches/MemberRoster.tsx`, `components/matches/AvatarTile.tsx`, `app/api/matches/[id]/register/route.ts` |
| US-20 | `components/matches/RegistrationRow.tsx`, `app/api/matches/[id]/guests/route.ts`, `app/api/matches/[id]/guests/[guestId]/route.ts` |
| US-21 | `app/management/page.tsx`, `components/management/MemberForm.tsx`, `app/api/members/route.ts` |
| US-22 | `app/management/page.tsx`, `components/management/MatchForm.tsx`, `app/api/matches/route.ts` |
| US-23 | `components/management/MatchForm.tsx`, `app/api/matches/route.ts` |
| US-24 | `components/management/MemberCard.tsx`, `app/api/members/[id]/route.ts` |
| US-25 | `components/management/MatchManageRow.tsx`, `app/api/matches/[id]/route.ts` |
| US-26 | `app/matches/[id]/page.tsx`, `components/matches/MatchCard.tsx` |
| US-27 | `components/matches/SettleForm.tsx`, `app/api/matches/[id]/route.ts` |
| US-28 | `components/ui/SyncButton.tsx`, `app/api/splitwise/expense/route.ts`, `app/api/matches/[id]/route.ts` |
