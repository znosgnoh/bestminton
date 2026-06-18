# Implementation Plan — Badminton Splitwise Integrator

**Source:** US-01 through US-16 (see `docs/`) + `CLAUDE.md`
**Stack:** Next.js 16 App Router · TypeScript · TailwindCSS v4 · Lucide Icons · React 19

---

## 1. File Tree

```
bestminton/
├── app/
│   ├── api/
│   │   └── splitwise/
│   │       ├── members/
│   │       │   └── route.ts          # GET – fetch Splitwise group members
│   │       └── expense/
│   │           └── route.ts          # POST – create expense in Splitwise
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                      # Single-page app shell
├── components/
│   ├── SessionForm.tsx               # Step 1 – Total Cost + Paid By (US-01, US-02)
│   ├── MemberList.tsx                # Step 2 – Attendance list container (US-03, US-04, US-14)
│   ├── MemberRow.tsx                 # Step 2 – One row per member (US-04, US-05, US-06)
│   ├── ReviewSummary.tsx             # Step 3 – Summary table (US-07, US-08, US-09)
│   ├── SyncButton.tsx                # Step 4 – Sync + status states (US-10, US-13, US-15)
│   └── ui/
│       ├── ErrorBanner.tsx           # Reusable error banner with Retry (US-13, US-14)
│       └── LoadingSpinner.tsx        # Reusable spinner
├── hooks/
│   └── useSessionState.ts            # All client state in one hook
├── lib/
│   ├── calculations.ts               # Weight + share math + rounding fix (US-07, US-08)
│   ├── splitwise.ts                  # Server-side Splitwise HTTP helper
│   └── types.ts                      # All shared TypeScript interfaces
├── .env.local                        # SPLITWISE_API_KEY, SPLITWISE_GROUP_ID
├── next.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

---

## 2. Core Types (`lib/types.ts`)

```typescript
// --- Splitwise API shapes ---

export interface SplitwiseMember {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  picture: { small: string; medium: string; large: string };
}

// --- Application domain models ---

export interface AttendanceRecord {
  memberId: number;
  firstName: string;
  lastName: string;
  present: boolean;
  hours: number;       // positive float; required when present = true
  guests: number;      // non-negative integer; default 0
}

export interface CalculatedShare {
  memberId: number;
  firstName: string;
  lastName: string;
  weight: number;      // W_i = hours * (1 + guests)
  owedShare: number;   // after rounding adjustment, in currency units
}

// --- Step-based UI state machine ---

export type AppStep = 'init' | 'attendance' | 'review' | 'done';
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

export interface SessionState {
  step: AppStep;
  totalCost: number | '';        // '' when field is empty
  paidById: number | null;
  members: SplitwiseMember[];
  attendance: AttendanceRecord[];
  membersLoading: boolean;
  membersError: string | null;
  syncStatus: SyncStatus;
  syncError: string | null;
}

// --- API contract: client → /api/splitwise/expense ---

export interface CreateExpenseRequest {
  totalCost: number;
  description: string;          // e.g. "Badminton – 18 Jun 2026"
  groupId: number;
  paidById: number;
  participants: Array<{
    userId: number;
    owedShare: number;           // already rounding-adjusted
  }>;
}

// --- Splitwise flat payload (internal, route handler only) ---

export type SplitwiseFlatPayload = Record<string, string | number>;
```

---

## 3. Calculation Logic (`lib/calculations.ts`)

### 3.1 Weight Formula

```typescript
export function computeWeight(hours: number, guests: number): number {
  return hours * (1 + guests);
}
```

### 3.2 Share Calculation with Rounding Fix (US-07, US-08)

```typescript
import { AttendanceRecord, CalculatedShare } from './types';
import { computeWeight } from './calculations';

export function calculateShares(
  attendance: AttendanceRecord[],
  totalCost: number
): CalculatedShare[] {
  const participants = attendance.filter((r) => r.present);

  const totalWeight = participants.reduce(
    (sum, r) => sum + computeWeight(r.hours, r.guests),
    0
  );

  // Step 1 – raw rounded shares
  const shares: CalculatedShare[] = participants.map((r) => {
    const weight = computeWeight(r.hours, r.guests);
    const rawOwed = (totalCost * weight) / totalWeight;
    return {
      memberId: r.memberId,
      firstName: r.firstName,
      lastName: r.lastName,
      weight,
      owedShare: Math.round(rawOwed * 100) / 100,
    };
  });

  // Step 2 – rounding correction applied to index 0
  const sumOwed = shares.reduce((s, r) => s + r.owedShare, 0);
  // Use integer arithmetic to avoid floating-point drift
  const diffCents = Math.round(totalCost * 100) - Math.round(sumOwed * 100);
  if (diffCents !== 0) {
    shares[0].owedShare =
      Math.round((shares[0].owedShare + diffCents / 100) * 100) / 100;
  }

  return shares;
}
```

**Invariant:** `shares.reduce((s, r) => s + r.owedShare, 0) === totalCost` always holds after this function.

---

## 4. API Route Specifications

### 4.1 `GET /api/splitwise/members` (`app/api/splitwise/members/route.ts`)

**Purpose:** Proxy to Splitwise to avoid CORS (US-03). Reads `SPLITWISE_GROUP_ID` from env.

**Flow:**
1. Read `SPLITWISE_API_KEY` and `SPLITWISE_GROUP_ID` from `process.env`.
2. `GET https://secure.splitwise.com/api/v3.0/get_group/:groupId` with `Authorization: Bearer <key>`.
3. Parse `response.group.members` array.
4. Return `{ members: SplitwiseMember[] }` to the client.
5. On failure, return `{ error: string }` with appropriate HTTP status.

**Error handling:** 401 → "Invalid API key", 404 → "Group not found", network → "Could not reach Splitwise".

---

### 4.2 `POST /api/splitwise/expense` (`app/api/splitwise/expense/route.ts`)

**Purpose:** Receive the validated session data, apply rounding, construct the Splitwise flat payload, and POST it server-to-server (US-10, US-11).

**Expected client request body:** `CreateExpenseRequest` (defined in §2)

**Transformation: client → Splitwise flat payload**

```typescript
function buildSplitwisePayload(
  req: CreateExpenseRequest
): SplitwiseFlatPayload {
  const payload: SplitwiseFlatPayload = {
    cost: req.totalCost.toFixed(2),
    description: req.description,
    group_id: req.groupId,
    currency_code: 'THB',   // adjust per deployment env
    split_equally: false,
  };

  req.participants.forEach((p, i) => {
    payload[`users__${i}__user_id`] = p.userId;
    payload[`users__${i}__owed_share`] = p.owedShare.toFixed(2);
    payload[`users__${i}__paid_share`] =
      p.userId === req.paidById
        ? req.totalCost.toFixed(2)
        : '0.00';
  });

  return payload;
}
```

**Rounding note:** The `owedShare` values arriving from the client have already been corrected by `calculateShares()` on the client. The route handler performs a **final server-side re-verification** before forwarding: sum all `owed_share` values and assert they equal `cost`. If not (e.g. client bug), abort with 422.

**Splitwise API call:**

```
POST https://secure.splitwise.com/api/v3.0/create_expense
Authorization: Bearer <SPLITWISE_API_KEY>
Content-Type: application/x-www-form-urlencoded

cost=1000.00&description=Badminton+...&group_id=12345&
users__0__user_id=101&users__0__paid_share=1000.00&users__0__owed_share=400.00&
users__1__user_id=102&users__1__paid_share=0.00&users__1__owed_share=350.00&
...
```

**Response handling:**
- 200/201 → return `{ success: true, expenseId: data.expense.id }` to client.
- 4xx from Splitwise → forward the Splitwise error message to the client.
- Network failure → return 502 with `{ error: "Could not reach Splitwise" }`.

---

## 5. UI Components

### 5.1 `SessionForm` (US-01, US-02)

**Props:** `members: SplitwiseMember[]`, `onSubmit(totalCost: number, paidById: number): void`

**Renders:**
- `<input type="number">` for Total Cost — validates `> 0`, shows inline error.
- `<select>` for "Paid by" — populated from `members`, required.
- "Next" button disabled until both fields are valid.

---

### 5.2 `MemberList` (US-03, US-14)

**Props:** `loading: boolean`, `error: string | null`, `attendance: AttendanceRecord[]`, `onRetry(): void`, `onToggle(id): void`, `onHoursChange(id, v): void`, `onGuestsChange(id, v): void`

**Renders:**
- While `loading` → `<LoadingSpinner />`
- While `error` → `<ErrorBanner message={error} onRetry={onRetry} />`
- Otherwise → list of `<MemberRow />` for each record.
- Footer: "Next: Review" button — disabled when 0 members are present (US-12).

---

### 5.3 `MemberRow` (US-04, US-05, US-06)

**Props:** `record: AttendanceRecord`, `onToggle(): void`, `onHoursChange(v: number): void`, `onGuestsChange(v: number): void`

**Renders:**
- Checkbox — toggles `present`.
- Member name (first + last).
- "Hours" input — enabled only when `present`; validates `> 0`; inline error if invalid.
- "Guests" input — enabled only when `present`; default `0`; validates `>= 0` integer.
- Unchecking clears hours back to `0` and guests to `0`.

---

### 5.4 `ReviewSummary` (US-07, US-08, US-09)

**Props:** `shares: CalculatedShare[]`, `totalCost: number`, `paidByName: string`, `onBack(): void`

**Renders:**
- Session metadata: Total Cost, Paid by.
- Table columns: Name | Hours | Guests | Weight | Owes
- Footer row: Total | — | — | — | `totalCost`
- "Back" button → returns to attendance step.
- "Sync to Splitwise" → rendered as `<SyncButton />`.

---

### 5.5 `SyncButton` (US-10, US-13, US-15)

**Props:** `status: SyncStatus`, `error: string | null`, `onClick(): void`, `onReset(): void`

**State rendering:**
- `idle` → enabled button "Sync to Splitwise".
- `syncing` → disabled button + `<LoadingSpinner />` inside.
- `success` → green checkmark + "Synced!" text + "Start New Session" button (calls `onReset`).
- `error` → red error message from `error` prop + "Retry" button re-enables.

---

### 5.6 `ErrorBanner` (US-13, US-14)

**Props:** `message: string`, `onRetry?(): void`

**Renders:** Red alert banner with the message and an optional "Retry" button.

---

### 5.7 `LoadingSpinner`

Simple animated SVG spinner, no props.

---

## 6. State Management (`hooks/useSessionState.ts`)

Single hook that owns all application state and exposes typed actions. No external state library needed.

**State shape:** `SessionState` (see §2).

**Exported actions:**

| Action | Description |
|---|---|
| `setTotalCost(v)` | Update total cost field |
| `setPaidBy(id)` | Set payer; auto-marks them as present |
| `loadMembers()` | Fetch `/api/splitwise/members`, populate `attendance` |
| `retryLoadMembers()` | Clears error and calls `loadMembers()` |
| `toggleAttendance(id)` | Toggle present; clear hours/guests on uncheck |
| `setHours(id, v)` | Update hours for a member |
| `setGuests(id, v)` | Update guests for a member |
| `goToReview()` | Validate all present members have hours > 0, advance step |
| `goBack()` | Return from review to attendance |
| `syncExpense()` | Run `calculateShares`, POST to `/api/splitwise/expense` |
| `reset()` | Return all state to initial values |

**Derived values** (computed inside the hook, not stored):

```typescript
const presentMembers = attendance.filter((r) => r.present);
const shares = presentMembers.length > 0
  ? calculateShares(attendance, totalCost as number)
  : [];
const canReview =
  typeof totalCost === 'number' &&
  totalCost > 0 &&
  paidById !== null &&
  presentMembers.length > 0 &&
  presentMembers.every((r) => r.hours > 0);
```

---

## 7. Page Assembly (`app/page.tsx`)

Step-based rendering — no router navigation needed (single page):

```
step === 'init'       → <SessionForm />
step === 'attendance' → <MemberList />
step === 'review'     → <ReviewSummary /> + <SyncButton />
step === 'done'       → handled inside <SyncButton status="success" />
```

---

## 8. Environment Variables (`.env.local`)

```
SPLITWISE_API_KEY=your_api_key_here
SPLITWISE_GROUP_ID=your_group_id_here
```

These are **never** sent to the client. Next.js enforces this — they have no `NEXT_PUBLIC_` prefix.

---

## 9. Implementation Steps

### Step 1 — Project Setup

1. Bootstrap: `npx create-next-app@16 . --typescript --tailwind --app --no-src-dir --import-alias "@/*" --no-eslint --yes`
2. Install: `npm install lucide-react`
3. Create `.env.local` with the two env vars.
4. Clean the default `app/page.tsx` and `globals.css`.

---

### Step 2 — Types & Calculation Utilities

**Files:** `lib/types.ts`, `lib/calculations.ts`

1. Write all interfaces from §2 into `lib/types.ts`.
2. Implement `computeWeight` and `calculateShares` from §3 into `lib/calculations.ts`.
3. Manually verify with example: `totalCost=100`, two members each 1.5h 0 guests → each owes 50.00. Three members (1h/0g, 1.5h/1g, 1h/0g) → weights 1, 3, 1 → shares 20.00, 60.00, 20.00.

**Covers:** US-07, US-08, US-16

---

### Step 3 — API Route Handlers

**Files:** `app/api/splitwise/members/route.ts`, `app/api/splitwise/expense/route.ts`, `lib/splitwise.ts`

1. Write `lib/splitwise.ts` — a thin server-side fetch wrapper that attaches `Authorization: Bearer` and handles Splitwise error shapes.
2. Write `GET /api/splitwise/members`:
   - Call `GET https://secure.splitwise.com/api/v3.0/get_group/{SPLITWISE_GROUP_ID}`
   - Return `{ members }` or `{ error }`.
3. Write `POST /api/splitwise/expense`:
   - Parse and validate `CreateExpenseRequest` body.
   - Server-side re-verify rounding invariant.
   - Call `buildSplitwisePayload()`.
   - POST to Splitwise as `application/x-www-form-urlencoded`.
   - Return success or structured error.

**Covers:** US-03, US-10, US-11, US-13, US-14

---

### Step 4 — Shared UI Components

**Files:** `components/ui/ErrorBanner.tsx`, `components/ui/LoadingSpinner.tsx`

1. Build `LoadingSpinner` — animated Lucide `Loader2` icon with `animate-spin`.
2. Build `ErrorBanner` — red border div, message text, optional "Retry" button.

---

### Step 5 — Feature UI Components

**Files:** `components/SessionForm.tsx`, `components/MemberRow.tsx`, `components/MemberList.tsx`, `components/ReviewSummary.tsx`, `components/SyncButton.tsx`

Build in this order (each depends on the previous being testable):

1. `SessionForm` — controlled inputs, inline validation, "Next" gating (US-01, US-02).
2. `MemberRow` — checkbox toggles, conditional input enable/disable, inline errors (US-04, US-05, US-06).
3. `MemberList` — wraps rows, shows loading/error/retry states, gates "Next" button (US-03, US-12, US-14).
4. `ReviewSummary` — renders `CalculatedShare[]` in a table with a footer total (US-07, US-09).
5. `SyncButton` — four visual states: idle, syncing, success, error (US-10, US-13, US-15).

---

### Step 6 — State Hook & Page Wiring

**Files:** `hooks/useSessionState.ts`, `app/page.tsx`

1. Implement `useSessionState` with all actions and derived values from §6.
2. Wire the step-based rendering in `app/page.tsx`.
3. Verify the full happy path end-to-end manually in the browser.

**Covers:** US-02 (payer auto-check), US-04 (uncheck clears fields), US-09 (back navigation), US-15 (reset after success).

---

### Step 7 — Edge Cases & Hardening

1. **US-12** — Confirm "Next: Review" and "Sync" are disabled with 0 present members.
2. **US-15** — Confirm button is disabled on click and replaced by success state post-sync.
3. **US-16** — Test with exactly 1 participant; assert `owedShare === totalCost`.
4. **US-08** — Test rounding with a case like `totalCost=10`, 3 members equal weight → 3.33 + 3.33 + 3.33 = 9.99; verify adjustment gives 3.34 + 3.33 + 3.33 = 10.00.
5. **US-13** — Simulate Splitwise 401 and network failure; verify error banner appears and form is not wiped.

---

## 10. User Story → File Cross-reference

| US | Files |
|---|---|
| US-01 | `components/SessionForm.tsx`, `hooks/useSessionState.ts` |
| US-02 | `components/SessionForm.tsx`, `hooks/useSessionState.ts` |
| US-03 | `app/api/splitwise/members/route.ts`, `components/MemberList.tsx` |
| US-04 | `components/MemberRow.tsx`, `hooks/useSessionState.ts` |
| US-05 | `components/MemberRow.tsx` |
| US-06 | `components/MemberRow.tsx` |
| US-07 | `lib/calculations.ts`, `components/ReviewSummary.tsx` |
| US-08 | `lib/calculations.ts`, `app/api/splitwise/expense/route.ts` |
| US-09 | `components/ReviewSummary.tsx`, `hooks/useSessionState.ts` |
| US-10 | `app/api/splitwise/expense/route.ts`, `components/SyncButton.tsx` |
| US-11 | `app/api/splitwise/expense/route.ts` |
| US-12 | `components/MemberList.tsx` |
| US-13 | `components/SyncButton.tsx`, `components/ui/ErrorBanner.tsx` |
| US-14 | `components/MemberList.tsx`, `components/ui/ErrorBanner.tsx` |
| US-15 | `components/SyncButton.tsx`, `hooks/useSessionState.ts` |
| US-16 | `lib/calculations.ts` |
