# Bestminton — Badminton Session Manager

A mobile-first web app for managing badminton team sessions end-to-end: scheduling, self-registration, guest tracking, and automated cost splitting via Splitwise.

---

## Features

- **Match scheduling** — Create one-off or recurring weekly sessions with title, venue, and time
- **Self-registration** — Players tap their avatar on the match page to join; no login required
- **Guest management** — Add named or anonymous guests with Full / Half-time flags; cost shares accordingly
- **Half/Full playtime** — Each player and guest can be marked Full or Half time, factoring into their cost share
- **Upcoming / Past tabs** — Both the homepage and management page split matches by date with nearest-first sorting
- **Post-match settlement** — Enter total court cost + who paid + hours played; the app calculates each share with exact cent rounding
- **Splitwise sync** — One-click expense creation to a Splitwise group (optional; app runs fully without it)
- **Dual storage** — Runs on IndexedDB (browser, zero setup) or Vercel Postgres (production)
- **Kèo (challenges)** — Singles/doubles friendly matches with Elo ratings, sub-linear suggested handicap (editable before start), side win probabilities that account for handicap (50 Elo per point on the weaker side), optional token betting, and a drink-debt ledger
- **Elo leaderboard** — `/leaderboard` ranks players by rating after completed kèo
- **Captain PIN** — Optional `CAPTAIN_PIN` protects `/management` and captain-only API mutations (settlement, Splitwise sync, member/match edits); unset = no gate (handy for local dev)
- **Dark mode** — System preference detected on load; toggleable in the header

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16 (App Router) |
| Frontend | React 19, TailwindCSS v4, Lucide Icons |
| Language | TypeScript |
| Database | Vercel Postgres via Prisma ORM (SQLite for local dev) |
| Local fallback | IndexedDB (browser) |
| Deployment | Vercel |

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

```env
# Database (Vercel Postgres — leave blank to use IndexedDB browser fallback)
POSTGRES_URL=
POSTGRES_PRISMA_URL=
POSTGRES_URL_NON_POOLING=

# Splitwise (optional — only needed for expense sync)
SPLITWISE_API_KEY=
SPLITWISE_GROUP_ID=
SPLITWISE_CURRENCY_CODE=USD

# Vercel Blob (optional — only needed for avatar file uploads)
BLOB_READ_WRITE_TOKEN=

# Captain PIN (optional — management UI + captain API mutations)
CAPTAIN_PIN=
```

### 3. Run database migrations (if using Postgres)

```bash
npx prisma migrate deploy
npx prisma generate
```

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> Without any env vars, the app uses IndexedDB automatically — no database setup required for local testing.

---

## Usage

### Players (homepage)

1. Open `/` — see the **Upcoming** tab with scheduled matches
2. Tap a match card → match detail page
3. Tap your avatar to register / unregister
4. Tap **+ Guest** to add a guest with an optional name and Full/Half-time flag
5. Toggle your own playtime (Full / ½ time) if needed

### Captain (management page)

Access `/management` directly in the browser (not linked in the nav — captain only). If `CAPTAIN_PIN` is set in the environment, enter it once per tab to unlock management (same PIN is used automatically for settlement at `/matches/[id]?manage=1`).

- **Members** — Add, edit, or remove team members; optionally link Splitwise IDs
- **Matches** — Create one-off or recurring matches; view upcoming and past matches in separate tabs
- **Kèo** — Create, edit handicap, start, and resolve challenges; linked from management and `/challenges`
- **Settle** — On a past match row, tap the clipboard icon to open the settlement page:
  1. Enter Total Cost ($), Who Paid, and Hours Played
  2. Review calculated shares per player
  3. Click **Sync to Splitwise** to create the group expense

Players use the **Kèo** nav item for the challenge list, betting on pending kèo, and the leaderboard.

---

## Cost Calculation Formula

Total court fee is split weighted by playtime and headcount:

```text
playerFactor_i  = 1.0  if player played full time, else 0.5
guestsFactor_i  = Σ (1.0 if guest played full time, else 0.5)  for each guest of player i

W_i             = hours × (playerFactor_i + guestsFactor_i)
W_total         = Σ W_i

Owed_i          = TotalCost × (W_i / W_total)
```

**Rounding:** Shares are rounded to 2 decimal places. Any cent discrepancy is added to / subtracted from the first participant's share so the sum equals `TotalCost` exactly (required by Splitwise).

---

## Project Structure

```text
app/
  page.tsx                  # Homepage — upcoming & past matches
  layout.tsx                # Root layout — header, dark mode init
  management/page.tsx       # Captain admin page (hidden from nav; PIN gate)
  challenges/                 # Kèo list, new, and detail pages
  leaderboard/page.tsx        # Elo rankings
  matches/[id]/
    page.tsx                # Match detail server component
    MatchDetailClient.tsx   # Match detail client (registration, settle)
  api/
    health/                 # DB availability check
    members/                # GET list, POST create, PUT/DELETE by id
    matches/                # GET list, POST create
    matches/[id]/           # GET detail, PUT update, DELETE
    matches/[id]/register/  # POST register, DELETE unregister
    matches/[id]/guests/    # POST add guest
    matches/[id]/guests/[guestId]/  # PUT update, DELETE remove
    splitwise/members/      # GET Splitwise group members
    splitwise/expense/      # POST create Splitwise expense

components/
  matches/                  # MatchCard, MatchTabs, MemberRoster, RegistrationRow, SettleForm
  management/               # MatchesSection, MatchManageRow, MatchForm, MembersSection, ...
  ui/                       # Avatar, DarkModeToggle, ConfirmDialog, ErrorBanner

lib/
  db.ts                     # Prisma client singleton
  idb.ts                    # IndexedDB primitives (browser)
  localDb.ts                # Full CRUD returning same DTOs as API
  dataService.ts            # Unified service — routes to API or IDB based on /api/health
  calculations.ts           # calculateShares() — weighted cost split with rounding fix
  splitwise.ts              # Splitwise API helpers
  types.ts                  # Shared DTO types

prisma/
  schema.prisma
  migrations/
```

---

## Vercel Blob (avatar uploads)

Avatar file uploads in `/management` are stored in [Vercel Blob](https://vercel.com/docs/storage/vercel-blob). URL paste still works without Blob configured.

### Setup

1. In the [Vercel dashboard](https://vercel.com/dashboard), open your project → **Storage** → **Create Database / Store** → **Blob**.
2. Name the store (e.g. `bestminton-avatars`) and connect it to this project.
3. Vercel adds `BLOB_READ_WRITE_TOKEN` to the project automatically.
4. For local dev, pull env vars:
   ```bash
   vercel env pull .env.local
   ```
   Or copy `BLOB_READ_WRITE_TOKEN` from the Blob store settings into `.env.local`.

Without `BLOB_READ_WRITE_TOKEN`, the upload API returns 503; members can still use avatar URLs (including Splitwise import).

---

## Deployment

Deploy to Vercel with one click. Set the Postgres and Splitwise env vars in the Vercel dashboard, then run:

```bash
npx prisma migrate deploy
```

via the Vercel build command or a post-deploy hook.
