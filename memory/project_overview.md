---
name: project-overview
description: Bestminton app tech stack, features implemented, and dual-storage architecture
metadata:
  type: project
---

Bestminton is a badminton session manager: members, matches (recurring), self-registration, guest management (with half/full playtime), and Splitwise cost splitting.

**Tech stack:** Next.js 16 App Router, React 19, TailwindCSS v4, Prisma 5 + SQLite (local) / Postgres (prod), Vercel.

**Dual-storage architecture (key):**
- `lib/idb.ts` — low-level IndexedDB primitives (browser only)
- `lib/localDb.ts` — full CRUD returning same DTOs as Prisma/API
- `lib/dataService.ts` — singleton service; calls `/api/health` on first use to detect DB availability, then routes all operations to real API or IndexedDB accordingly
- `app/api/health/route.ts` — returns `{ db: true/false }` based on Prisma connectivity

**How pages handle dual storage:**
- Server pages try to fetch from DB; on failure pass `dbAvailable: false` + empty arrays
- Client components (MatchTabs, MatchDetailClient, MembersSection, MatchesSection) load from `dataService.getMatches()` / `getMatch()` / `getMembers()` on mount when `!dbAvailable`
- All mutations (register, guest add, settle, member/match CRUD) go through `dataService.*` functions which route to API or IDB

**Why:** User wants browser-only IndexedDB for local testing (no server DB setup), switching to Postgres via `.env.local` when ready.
