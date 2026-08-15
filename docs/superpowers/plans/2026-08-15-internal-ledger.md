# Internal Expense Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Splitwise as the source of truth for court money with an in-app expense ledger, dual-write to Splitwise this month, then cut over by unsetting Splitwise env vars.

**Architecture:** Postgres `Expense` + `ExpenseShare` is the ledger. Settle always writes the ledger first; if Splitwise is configured, the same action POSTs to Splitwise and stores `splitwiseExpenseId`. Balances are derived (unpaid remainders → pairwise nets → `simplifyDebts`). Captain marks paid with PIN (FIFO on shares). Nước cam stays on `DrinkDebt`.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript · Prisma · Vercel Postgres · TailwindCSS v4 · existing `lib/calculations.ts` + `lib/drinkDebtUtils.ts` + `lib/splitwise.ts`

**Spec:** `docs/superpowers/specs/2026-08-15-internal-ledger-design.md`

## Global Constraints

- Read `node_modules/next/dist/docs/` before new App Router code (Next.js 16).
- Bridge **on** = `isSplitwiseConfigured()` (`SPLITWISE_API_KEY` and `SPLITWISE_GROUP_ID` set). Bridge **off** = those unset. No extra env flag.
- Currency = `getCurrencyCode()` (`SPLITWISE_CURRENCY_CODE` ?? `"SGD"`). Do not invent a second currency source in v1.
- Money is 2 decimal places. Sum of `ExpenseShare.owed` must equal `Expense.amount` (same cent-fix as `calculateShares`).
- Creditor is only `Expense.paidByMemberId`. That member has **no** `ExpenseShare` row.
- `MATCH`: `paidByMemberId` = court payer. Other registrations with `owedShare > 0` get shares. Skip a share when `memberId === paidByMemberId`.
- `SHUTTLECOCK`: `paidByMemberId` = shuttlecock **recipient**. One share: court payer owes the shuttlecock fee. Same skip rules as `shouldCreateShuttlecockRemittance`.
- At most one `MATCH` and one `SHUTTLECOCK` per `matchId` (`@@unique([matchId, kind])`). `OPENING` has `matchId = null`.
- Re-import replaces **only** `kind = OPENING`.
- Captain mutations use `requireAdminPin` / `withAdminPin` like other management APIs.
- Do not write court money into `DrinkDebt`. Reuse `simplifyDebts` / `DebtEdge` from `lib/drinkDebtUtils.ts`.
- Do not drop `Member.splitwiseId` or `Match.synced` in v1.
- After cutover (bridge off), settle must not require `splitwiseId`.
- i18n: add keys to `en.ts`, `vi.ts`, and `zh.ts`. Nav: EN **Balances**, VI **Sổ**, ZH **账本**.
- Tests: `tsx --test lib/**/*.test.ts` (same as `npm test`).
- No player login. Players pick “I am …” to view. No Paid button for players.
- No `groupId` column in v1; keep ledger functions free of “the one team” hardcoding so a later `groupId` can wrap queries.

---

## File tree

```
bestminton/
├── prisma/schema.prisma                          [UPDATE] Expense, ExpenseShare, enums
├── prisma/migrations/…_internal_ledger/          [NEW]
├── lib/
│   ├── types.ts                                  [UPDATE] ledger DTOs + API bodies
│   ├── drinkDebtUtils.ts                         [KEEP] reuse DebtEdge + simplifyDebts
│   ├── calculations.ts                           [KEEP] calculateShares
│   ├── shuttlecock.ts                            [KEEP] remittance rules
│   ├── splitwise.ts                              [UPDATE] parse group member nets
│   ├── ledgerMath.ts                             [NEW] remainders → edges, FIFO mark-paid
│   ├── ledgerOpening.ts                          [NEW] Splitwise nets → opening pairs
│   ├── ledgerService.ts                          [NEW] record / import / mark-paid / snapshot
│   ├── dataService.ts                            [UPDATE] client wrappers
│   └── i18n/messages/{en,vi,zh}.ts               [UPDATE]
├── app/
│   ├── api/ledger/
│   │   ├── route.ts                              [NEW] GET snapshot
│   │   ├── record/route.ts                       [NEW] POST record match (dual-write)
│   │   ├── import/route.ts                       [NEW] POST import openings (PIN)
│   │   └── settle/route.ts                       [NEW] POST mark-paid (PIN)
│   ├── api/splitwise/expense/route.ts            [KEEP] called only from ledgerService when bridge on
│   ├── balances/
│   │   ├── page.tsx                              [NEW]
│   │   ├── loading.tsx                           [NEW]
│   │   ├── BalancesLoader.tsx                    [NEW]
│   │   └── BalancesPageClient.tsx                [NEW]
│   └── management/page.tsx                       [UPDATE] pass bridge flag
├── components/
│   ├── layout/AppHeader.tsx                      [UPDATE] nav link
│   ├── balances/
│   │   ├── BalanceMeTab.tsx                      [NEW]
│   │   ├── BalanceGroupTab.tsx                   [NEW]
│   │   ├── BalanceEdgeRow.tsx                    [NEW]
│   │   └── BalanceBreakdown.tsx                  [NEW]
│   ├── matches/SettleForm.tsx                    [UPDATE] record + retry copy
│   └── management/MembersSection.tsx             [UPDATE] import openings button
├── CLAUDE.md                                     [UPDATE] routes + env note
└── lib/*.test.ts                                 [NEW] ledgerMath, ledgerOpening
```

Unlisted files stay as they are. Do not add `app/api/splitwise/route.ts` (planner template); expense sync stays at `app/api/splitwise/expense/route.ts` and is invoked from `ledgerService`, not from a new flattened-payload route.

---

## Core types (`lib/types.ts`)

Add these interfaces (do not remove `CreateExpenseRequest` — Splitwise POST still uses it internally):

```ts
export type LedgerExpenseKind = "MATCH" | "SHUTTLECOCK" | "OPENING";
export type LedgerExpenseStatus = "OPEN" | "SETTLED";

export interface LedgerExpenseShareDTO {
  id: number;
  expenseId: number;
  memberId: number;
  memberName: string;
  owed: number;
  paid: number;
}

export interface LedgerExpenseDTO {
  id: number;
  kind: LedgerExpenseKind;
  matchId: number | null;
  title: string;
  amount: number;
  currency: string;
  paidByMemberId: number;
  paidByName: string;
  status: LedgerExpenseStatus;
  splitwiseExpenseId: number | null;
  createdAt: string;
  shares: LedgerExpenseShareDTO[];
}

export interface LedgerEdgeDTO {
  debtorId: number;
  debtorName: string;
  creditorId: number;
  creditorName: string;
  amount: number;
}

export interface LedgerBreakdownItemDTO {
  expenseId: number;
  kind: LedgerExpenseKind;
  title: string;
  createdAt: string;
  remainder: number;
}

export interface LedgerSnapshotDTO {
  currency: string;
  bridgeOn: boolean;
  edges: LedgerEdgeDTO[];
  expenses: LedgerExpenseDTO[];
}

export interface RecordMatchLedgerRequest {
  matchId: number;
  pin?: string;
}

export interface RecordMatchLedgerResponse {
  matchExpense: LedgerExpenseDTO;
  shuttlecockExpense: LedgerExpenseDTO | null;
  splitwiseSynced: boolean;
  splitwiseError: string | null;
}

export interface ImportOpeningBalancesResponse {
  created: number;
  skippedUnmapped: Array<{ splitwiseId: number; name: string; net: number }>;
  skippedZero: number;
}

export interface MarkLedgerPaidRequest {
  debtorId: number;
  creditorId: number;
  amount: number;
  pin?: string;
}
```

---

## API contracts

| Method | Path | Auth | Body | Success |
| --- | --- | --- | --- | --- |
| GET | `/api/ledger` | none | — | `LedgerSnapshotDTO` |
| POST | `/api/ledger/record` | captain PIN | `{ matchId, pin? }` | `RecordMatchLedgerResponse` |
| POST | `/api/ledger/import` | captain PIN | `{ pin? }` | `ImportOpeningBalancesResponse` |
| POST | `/api/ledger/settle` | captain PIN | `{ debtorId, creditorId, amount, pin? }` | `LedgerSnapshotDTO` |

**POST `/api/ledger/record`**

1. Load match with registrations, `paidBy`, `shuttlecockRecipient`. 404 if missing. 400 if `totalCost` / `hours` / `paidByMemberId` unset.
2. `calculateShares(registrations, totalCost, hours)`.
3. Upsert `MATCH` expense: if one exists for `matchId`, reuse it (retry path). Else create: `paidByMemberId` = court payer; shares = participants with `owedShare > 0` and `memberId !== paidBy`. Amount = sum of those shares (payer’s own share is not a debt to themselves).
4. If `shouldCreateShuttlecockRemittance(...)`, upsert `SHUTTLECOCK` expense: creditor = recipient, one share = shuttlecock fee on the court payer.
5. If bridge on: build existing Splitwise payloads (`buildCreateExpensePayload` / remittance) using **Splitwise user IDs**. On success set `splitwiseExpenseId`, `Match.synced = true`, `shuttlecockRemitted` as today. On failure leave ledger rows, return `splitwiseSynced: false` and `splitwiseError`.
6. If bridge off: skip Splitwise; do not require `splitwiseId`; `splitwiseSynced: false`, `splitwiseError: null`.

Rounding: use `calculateShares` as-is. Ledger MATCH amount = sum of non-payer `owedShare` values (the payer’s share is money they “owe themselves” and is not a share row). That sum plus the payer’s own `owedShare` equals `totalCost`.

**POST `/api/ledger/import`**

1. 503 if bridge off.
2. `GET /get_group/{id}` via `splitwiseFetch`. Parse each member’s `balance[]` for `getCurrencyCode()`. Net = `Number(amount)` (positive = owed to them).
3. Map `splitwiseId` → `Member`. Unmapped → `skippedUnmapped`. `|net| < 0.005` → `skippedZero`.
4. `openingPairsFromNets(nets)` → pairwise edges.
5. In one transaction: `deleteMany({ kind: OPENING })`, then create one `OPENING` expense per edge (`title`: `"Splitwise opening"`, `paidByMemberId` = creditor, one share = debtor/`amount`).
6. Do not delete `MATCH` / `SHUTTLECOCK`.

**POST `/api/ledger/settle`**

1. PIN required. `amount` must be a positive number with at most 2 decimals.
2. `applyMarkPaidFifo(sharesForPair, amount)` updates `paid`. If current simplified edge for that pair is 0, return snapshot unchanged (idempotent).
3. Recompute each touched expense `status`: `SETTLED` iff every share has `paid >= owed`.

**GET `/api/ledger`**

Load all expenses + shares + member names. Build raw edges from `owed - paid > 0` as `{ debtorId: share.memberId, creditorId: expense.paidByMemberId, amount: remainder }`. `edges = simplifyDebts(raw)`. Include full `expenses` for breakdown.

---

## UI components

| Component | Role |
| --- | --- |
| `BalancesPageClient` | Tabs My / Group; loads snapshot via `dataService.getLedger()` |
| `BalanceMeTab` | Avatar picker (“I am …”) like `MemberRoster`; filters edges for that member |
| `BalanceGroupTab` | All simplified edges |
| `BalanceEdgeRow` | “An → Bình · S$24”; captain sees Paid (PIN) |
| `BalanceBreakdown` | Expenses that contribute remainder for that pair |
| `SettleForm` | Record/Sync button calls `/api/ledger/record`; retry uses same endpoint |
| `MembersSection` | “Import Splitwise balances” when `bridgeOn` |

---

## Task 1: Prisma ledger models

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_internal_ledger/migration.sql` via `npx prisma migrate dev --name internal_ledger`
- Modify: `lib/types.ts` (add types listed above)

**Interfaces:**
- Consumes: existing `Member`, `Match`
- Produces: Prisma `Expense`, `ExpenseShare`, enums `LedgerExpenseKind`, `LedgerExpenseStatus`

- [ ] **Step 1: Add models to `schema.prisma`**

```prisma
enum LedgerExpenseKind {
  MATCH
  SHUTTLECOCK
  OPENING
}

enum LedgerExpenseStatus {
  OPEN
  SETTLED
}

model Expense {
  id                 Int                 @id @default(autoincrement())
  kind               LedgerExpenseKind
  matchId            Int?
  title              String
  amount             Decimal             @db.Decimal(12, 2)
  currency           String
  paidByMemberId     Int
  status             LedgerExpenseStatus @default(OPEN)
  splitwiseExpenseId Int?
  createdAt          DateTime            @default(now())

  match   Match?         @relation(fields: [matchId], references: [id], onDelete: SetNull)
  paidBy  Member         @relation("ExpenseCreditor", fields: [paidByMemberId], references: [id])
  shares  ExpenseShare[]

  @@unique([matchId, kind])
  @@index([kind])
}

model ExpenseShare {
  id         Int     @id @default(autoincrement())
  expenseId  Int
  memberId   Int
  owed       Decimal @db.Decimal(12, 2)
  paid       Decimal @db.Decimal(12, 2) @default(0)

  expense Expense @relation(fields: [expenseId], references: [id], onDelete: Cascade)
  member  Member  @relation("ExpenseShareMember", fields: [memberId], references: [id])

  @@unique([expenseId, memberId])
}
```

Add reverse relations on `Member` (`expensesCredited`, `expenseShares`) and `Match` (`ledgerExpenses Expense[]`).

- [ ] **Step 2: Migrate and generate**

Run: `npx prisma migrate dev --name internal_ledger && npx prisma generate`  
Expected: migration applied, client includes `db.expense`.

- [ ] **Step 3: Add TypeScript DTOs** to `lib/types.ts` exactly as in **Core types** above.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations lib/types.ts
git commit -m "feat: add Expense and ExpenseShare ledger models"
```

---

## Task 2: Ledger math (TDD)

**Files:**
- Create: `lib/ledgerMath.ts`
- Test: `lib/ledgerMath.test.ts`

**Interfaces:**
- Consumes: `DebtEdge`, `simplifyDebts` from `lib/drinkDebtUtils.ts`
- Produces:
  - `toCents(n: number): number`
  - `fromCents(c: number): number`
  - `remaindersToEdges(items: LedgerRemainder[]): DebtEdge[]`
  - `ledgerSimplifiedEdges(items: LedgerRemainder[]): DebtEdge[]`
  - `applyMarkPaidFifo(shares: FifoShare[], amount: number): FifoShare[]`
  - `expenseStatus(shares: Array<{ owed: number; paid: number }>): "OPEN" | "SETTLED"`

```ts
export type LedgerRemainder = {
  debtorId: number;
  creditorId: number;
  remainder: number;
};

export type FifoShare = {
  id: number;
  debtorId: number;
  creditorId: number;
  owed: number;
  paid: number;
  createdAt: string; // ISO
};
```

- [ ] **Step 1: Write the failing tests** in `lib/ledgerMath.test.ts`

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyMarkPaidFifo,
  expenseStatus,
  ledgerSimplifiedEdges,
  remaindersToEdges,
} from "./ledgerMath";

describe("remaindersToEdges", () => {
  it("drops zero remainders and self-debts", () => {
    assert.deepEqual(
      remaindersToEdges([
        { debtorId: 1, creditorId: 2, remainder: 10 },
        { debtorId: 3, creditorId: 4, remainder: 0 },
        { debtorId: 5, creditorId: 5, remainder: 3 },
      ]),
      [{ debtorId: 1, creditorId: 2, amount: 10 }]
    );
  });
});

describe("ledgerSimplifiedEdges", () => {
  it("nets A↔B and can collapse A→B→C", () => {
    const edges = ledgerSimplifiedEdges([
      { debtorId: 1, creditorId: 2, remainder: 10 },
      { debtorId: 2, creditorId: 1, remainder: 4 },
      { debtorId: 2, creditorId: 3, remainder: 6 },
    ]);
    assert.deepEqual(edges, [{ debtorId: 1, creditorId: 3, amount: 6 }]);
  });

  it("does not invent edges across disconnected people", () => {
    const edges = ledgerSimplifiedEdges([
      { debtorId: 1, creditorId: 2, remainder: 5 },
      { debtorId: 3, creditorId: 4, remainder: 5 },
    ]);
    assert.equal(edges.length, 2);
  });
});

describe("applyMarkPaidFifo", () => {
  const shares = [
    { id: 1, debtorId: 1, creditorId: 2, owed: 10, paid: 0, createdAt: "2026-08-01T00:00:00.000Z" },
    { id: 2, debtorId: 1, creditorId: 2, owed: 8, paid: 0, createdAt: "2026-08-10T00:00:00.000Z" },
  ];

  it("pays oldest share first", () => {
    const next = applyMarkPaidFifo(shares, 12);
    assert.equal(next[0].paid, 10);
    assert.equal(next[1].paid, 2);
  });

  it("is idempotent when amount is 0", () => {
    assert.deepEqual(applyMarkPaidFifo(shares, 0), shares);
  });

  it("does not pay past owed", () => {
    const next = applyMarkPaidFifo(shares, 999);
    assert.equal(next[0].paid, 10);
    assert.equal(next[1].paid, 8);
  });
});

describe("expenseStatus", () => {
  it("is SETTLED only when every share is fully paid", () => {
    assert.equal(expenseStatus([{ owed: 5, paid: 5 }]), "SETTLED");
    assert.equal(expenseStatus([{ owed: 5, paid: 4 }]), "OPEN");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx tsx --test lib/ledgerMath.test.ts`  
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `lib/ledgerMath.ts`**

```ts
import { simplifyDebts, type DebtEdge } from "./drinkDebtUtils";

export type LedgerRemainder = {
  debtorId: number;
  creditorId: number;
  remainder: number;
};

export type FifoShare = {
  id: number;
  debtorId: number;
  creditorId: number;
  owed: number;
  paid: number;
  createdAt: string;
};

export function toCents(n: number): number {
  return Math.round(n * 100);
}

export function fromCents(c: number): number {
  return Math.round(c) / 100;
}

export function remaindersToEdges(items: LedgerRemainder[]): DebtEdge[] {
  return items
    .filter((i) => i.remainder > 0 && i.debtorId !== i.creditorId)
    .map((i) => ({
      debtorId: i.debtorId,
      creditorId: i.creditorId,
      amount: fromCents(toCents(i.remainder)),
    }));
}

export function ledgerSimplifiedEdges(items: LedgerRemainder[]): DebtEdge[] {
  return simplifyDebts(remaindersToEdges(items));
}

export function applyMarkPaidFifo(shares: FifoShare[], amount: number): FifoShare[] {
  let remaining = toCents(amount);
  if (remaining <= 0) return shares.map((s) => ({ ...s }));

  const ordered = [...shares].sort((a, b) => {
    const t = a.createdAt.localeCompare(b.createdAt);
    return t !== 0 ? t : a.id - b.id;
  });

  return ordered.map((s) => {
    const due = toCents(s.owed) - toCents(s.paid);
    if (remaining <= 0 || due <= 0) return { ...s };
    const apply = Math.min(due, remaining);
    remaining -= apply;
    return { ...s, paid: fromCents(toCents(s.paid) + apply) };
  });
}

export function expenseStatus(
  shares: Array<{ owed: number; paid: number }>
): "OPEN" | "SETTLED" {
  if (shares.length === 0) return "SETTLED";
  return shares.every((s) => toCents(s.paid) >= toCents(s.owed)) ? "SETTLED" : "OPEN";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsx --test lib/ledgerMath.test.ts`  
Expected: PASS. If the A→B→C case fails because `simplifyDebts` keeps a different collapse, **do not change drink-debt behavior**. Adjust the test to assert the actual `simplifyDebts` output for those remainders (same function the UI will use). The invariant that must hold: disconnected pairs stay two edges; A↔B nets.

- [ ] **Step 5: Commit**

```bash
git add lib/ledgerMath.ts lib/ledgerMath.test.ts
git commit -m "feat: add ledger remainder, simplify, and FIFO mark-paid math"
```

---

## Task 3: Opening-balance mapper (TDD)

**Files:**
- Create: `lib/ledgerOpening.ts`
- Test: `lib/ledgerOpening.test.ts`
- Modify: `lib/splitwise.ts` — add `parseGroupMemberNet(member, currency): number`

**Interfaces:**
- Consumes: `minimizeDebtTransactions` pattern via local pairing (or `simplifyDebts` on synthetic nets)
- Produces:
  - `parseGroupMemberNet(balances: Array<{ amount: string; currency_code: string }>, currency: string): number`
  - `openingPairsFromNets(nets: Array<{ memberId: number; net: number }>): DebtEdge[]`

Splitwise group member `balance` (from `GET /get_group/{id}`): positive `amount` = the group owes them (creditor). Negative = they owe the group. Use the entry whose `currency_code` matches `getCurrencyCode()`. If none, net = 0.

`openingPairsFromNets`: treat `net > 0` as creditor capacity and `net < 0` as debtor load. Pair with the same greedy algorithm as `minimizeDebtTransactions` (copy the loop; do not pass fake edges through `simplifyDebts`). Skip `|net| < 0.005`.

- [ ] **Step 1: Write failing tests**

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { openingPairsFromNets, parseGroupMemberNet } from "./ledgerOpening";

describe("parseGroupMemberNet", () => {
  it("reads the matching currency", () => {
    const net = parseGroupMemberNet(
      [
        { amount: "10.00", currency_code: "USD" },
        { amount: "-24.50", currency_code: "SGD" },
      ],
      "SGD"
    );
    assert.equal(net, -24.5);
  });

  it("is 0 when currency is missing", () => {
    assert.equal(parseGroupMemberNet([{ amount: "1", currency_code: "USD" }], "SGD"), 0);
  });
});

describe("openingPairsFromNets", () => {
  it("pairs a single debtor with a single creditor", () => {
    const pairs = openingPairsFromNets([
      { memberId: 1, net: -20 },
      { memberId: 2, net: 20 },
    ]);
    assert.deepEqual(pairs, [{ debtorId: 1, creditorId: 2, amount: 20 }]);
  });

  it("skips near-zero nets", () => {
    assert.deepEqual(openingPairsFromNets([{ memberId: 1, net: 0.001 }]), []);
  });
});
```

- [ ] **Step 2: Run** `npx tsx --test lib/ledgerOpening.test.ts` — expect FAIL.

- [ ] **Step 3: Implement `lib/ledgerOpening.ts`**

```ts
import { type DebtEdge } from "./drinkDebtUtils";
import { fromCents, toCents } from "./ledgerMath";

export function parseGroupMemberNet(
  balances: Array<{ amount: string; currency_code: string }>,
  currency: string
): number {
  const row = balances.find((b) => b.currency_code === currency);
  if (!row) return 0;
  const n = Number(row.amount);
  return Number.isFinite(n) ? n : 0;
}

export function openingPairsFromNets(
  nets: Array<{ memberId: number; net: number }>
): DebtEdge[] {
  const debtors = nets
    .filter((n) => n.net < -0.005)
    .map((n) => ({ id: n.memberId, amount: toCents(-n.net) }))
    .sort((a, b) => b.amount - a.amount || a.id - b.id);
  const creditors = nets
    .filter((n) => n.net > 0.005)
    .map((n) => ({ id: n.memberId, amount: toCents(n.net) }))
    .sort((a, b) => b.amount - a.amount || a.id - b.id);

  const result: DebtEdge[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const transfer = Math.min(debtors[i].amount, creditors[j].amount);
    if (transfer > 0) {
      result.push({
        debtorId: debtors[i].id,
        creditorId: creditors[j].id,
        amount: fromCents(transfer),
      });
    }
    debtors[i].amount -= transfer;
    creditors[j].amount -= transfer;
    if (debtors[i].amount === 0) i++;
    if (creditors[j].amount === 0) j++;
  }
  return result.sort((a, b) => b.amount - a.amount || a.debtorId - b.debtorId);
}
```

- [ ] **Step 4: Run** `npx tsx --test lib/ledgerOpening.test.ts` — expect PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/ledgerOpening.ts lib/ledgerOpening.test.ts
git commit -m "feat: map Splitwise group nets to opening ledger pairs"
```

---

## Task 4: `ledgerService` record + snapshot

**Files:**
- Create: `lib/ledgerService.ts`
- Modify: `lib/splitwise.ts` only if `parseGroupMemberNet` lives better next to `SplitwiseGroupResponse` (keep parser in `ledgerOpening.ts` unless types need extending)

**Interfaces:**
- Consumes: `calculateShares`, `shouldCreateShuttlecockRemittance`, `splitSettlementFees`, `formatShuttlecockRemittanceDescription`, `db`, `ledgerMath`, `getCurrencyCode`
- Produces:
  - `getLedgerSnapshot(): Promise<LedgerSnapshotDTO>`
  - `recordMatchExpenses(matchId: number): Promise<RecordMatchLedgerResponse>` (Splitwise part can be a stub returning `splitwiseSynced: false` until Task 5)
  - `decimalToNumber(d: Prisma.Decimal): number` helper

**MATCH amount:** sum of `owedShare` for `memberId !== paidByMemberId`. If that sum is 0 (payer was the only player), do not create a MATCH expense.

**Retry:** `findUnique` on `@@unique([matchId, kind])`. If MATCH exists, do not create another; proceed to Splitwise attach (Task 5).

- [ ] **Step 1: Implement `getLedgerSnapshot` and `recordMatchExpenses` (ledger-only).** Convert Prisma `Decimal` with `Number(value)` after validating finite.

Serialize names from joined `Member`. Remainders: `fromCents(toCents(owed) - toCents(paid))`.

- [ ] **Step 2: Manually verify with `npx tsc --noEmit`** — expect exit 0.

- [ ] **Step 3: Commit**

```bash
git add lib/ledgerService.ts
git commit -m "feat: record match and shuttlecock expenses on the internal ledger"
```

---

## Task 5: Dual-write and retry

**Files:**
- Modify: `lib/ledgerService.ts`
- Modify: `app/api/splitwise/expense/route.ts` — extract the Splitwise POST + remittance block into a function exported from `lib/splitwiseSync.ts` **or** call existing helpers (`postSplitwiseExpense`, `buildCreateExpensePayload`, `buildShuttlecockRemittancePayload`, `fetchGroupMembers`, `findParticipantsMissingFromGroup`) from `ledgerService` so `/api/splitwise/expense` can eventually become a thin deprecated wrapper. Prefer **calling helpers from `ledgerService`** and changing `/api/splitwise/expense` to `POST` → `recordMatchExpenses` (one entry point). That prevents two code paths creating expenses.

**Interfaces:**
- Consumes: existing Splitwise helpers
- Produces: `recordMatchExpenses` sets `splitwiseExpenseId` / `Match.synced` / `shuttlecockRemitted` on success; on failure returns `splitwiseError` without rolling back ledger rows

- [ ] **Step 1: Point `POST /api/splitwise/expense` at `recordMatchExpenses(body.matchId)`** after PIN + `matchId` validation. Keep the same JSON error shape as much as possible (`error` string) so old clients do not break. New fields (`splitwiseSynced`, `splitwiseError`) are additive.

- [ ] **Step 2: Bridge off:** if `!isSplitwiseConfigured()`, `recordMatchExpenses` still writes the ledger and returns `splitwiseSynced: false`. Do **not** return 503.

- [ ] **Step 3: `npx tsc --noEmit`** — expect exit 0.

- [ ] **Step 4: Commit**

```bash
git add lib/ledgerService.ts app/api/splitwise/expense/route.ts
git commit -m "feat: dual-write settle to ledger then Splitwise"
```

---

## Task 6: Ledger API routes + dataService

**Files:**
- Create: `app/api/ledger/route.ts`
- Create: `app/api/ledger/record/route.ts`
- Create: `app/api/ledger/import/route.ts`
- Create: `app/api/ledger/settle/route.ts`
- Modify: `lib/dataService.ts`
- Modify: `lib/ledgerService.ts` — add `importOpeningBalances()`, `markLedgerPaid(debtorId, creditorId, amount)`

**Interfaces:**
- Consumes: `requireDatabase`, `requireAdminPin`, `pinFromRequest`, `ledgerService`
- Produces: `dataService.getLedger`, `recordMatchLedger`, `importOpeningBalances`, `markLedgerPaid`

`importOpeningBalances` algorithm:

1. `splitwiseFetch(/get_group/${getGroupId()})`
2. Parse members + balances
3. `db.member.findMany({ where: { splitwiseId: { not: null } } })`
4. Build nets / skipped lists
5. `openingPairsFromNets`
6. Transaction: delete OPENING, create expenses + shares

`markLedgerPaid`:

1. Load shares where `memberId = debtorId` and `expense.paidByMemberId = creditorId` and `paid < owed`, order `createdAt`, `id`
2. Current remainder for that pair = sum of remainders. If `toCents(amount) > that` and the simplified edge is already 0, return snapshot (idempotent). If amount is larger than remaining pair remainder but remainder > 0, pay only the remaining (do not 400).
3. `applyMarkPaidFifo`, write `paid`, update expense `status`

- [ ] **Step 1: Implement service methods + four routes.** `export const dynamic = "force-dynamic"` on each.

- [ ] **Step 2: Add dataService wrappers using `challengeFetch` or `apiFetch` + `jsonHeaders` / `withAdminPin` for POSTs.**

- [ ] **Step 3: `npx tsc --noEmit`** — expect exit 0.

- [ ] **Step 4: Commit**

```bash
git add app/api/ledger lib/ledgerService.ts lib/dataService.ts
git commit -m "feat: add ledger snapshot, import, record, and mark-paid APIs"
```

---

## Task 7: Balances page

**Files:**
- Create: `app/balances/page.tsx`, `loading.tsx`, `BalancesLoader.tsx`, `BalancesPageClient.tsx`
- Create: `components/balances/BalanceMeTab.tsx`, `BalanceGroupTab.tsx`, `BalanceEdgeRow.tsx`, `BalanceBreakdown.tsx`
- Modify: `components/layout/AppHeader.tsx`
- Modify: `lib/i18n/messages/en.ts`, `vi.ts`, `zh.ts`
- Modify: `components/ui/Skeleton.tsx` — add `BalancesPageSkeleton` (copy `CamPageSkeleton` layout)

**Interfaces:**
- Consumes: `LedgerSnapshotDTO`, `useAdminPin`, `dataService.markLedgerPaid`
- Produces: `/balances` with My / Group tabs

**My tab:** `AvatarTile` grid of members from snapshot expense participants ∪ edge ids ∪ `getMembers()`. Persist selected id in `localStorage` key `bestminton_balance_member` (view preference only).

**Paid:** only if `useAdminPin` says unlocked **or** `!pinRequired`; if PIN required and locked, open `AdminPinModal` then call `markLedgerPaid`. Players never see Paid unless they unlocked captain PIN in this tab (same as other captain actions). Do not show Paid on the Group tab for users who have not unlocked — actually spec says captain sees Paid on balances. Use the same pattern as `/cam` settle: show Paid, prompt PIN if needed.

**Breakdown:** filter `expenses` whose shares have remainder for that debtor and `paidByMemberId === creditor`.

- [ ] **Step 1: Add i18n keys** (all three locales):

```
nav.balances: Balances | Sổ | 账本
balances.title, .myTab, .groupTab, .pickPlayer, .youOwe, .owedToYou, .allClear,
.markPaid, .paidOk, .breakdown, .opening, .match, .shuttlecock, .bridgeOnHint,
.dbRequired
```

- [ ] **Step 2: Build page + components** using `tet-card`, `tet-tab`, `tet-btn-primary` like `/cam`.

- [ ] **Step 3: Link in `AppHeader`** after orange juice.

- [ ] **Step 4: Commit**

```bash
git add app/balances components/balances components/layout/AppHeader.tsx components/ui/Skeleton.tsx lib/i18n
git commit -m "feat: add balances page for court-money ledger"
```

---

## Task 8: Settle + management adoption

**Files:**
- Modify: `components/matches/SettleForm.tsx`
- Modify: `components/management/MembersSection.tsx`
- Modify: `app/management/page.tsx` / `ManagementPageClient.tsx` (pass `splitwiseConfigured` as today; reuse as `bridgeOn`)
- Modify: `CLAUDE.md` §5 routes and §8 env (document: unset Splitwise keys = bridge off, ledger still works)

**SettleForm behavior:**

- Always call `dataService.recordMatchLedger({ matchId })` (or existing `/api/splitwise/expense` if Task 5 redirected it — **one client path only**).
- Bridge on + success + `splitwiseSynced`: existing “Synced to Splitwise” success.
- Ledger saved + `splitwiseError`: `tet-alert` “Saved here, Splitwise failed — retry.” Retry button calls the same record endpoint.
- Bridge off: button label `Record expense` / i18n `matches.recordExpense`. Success: “Recorded on balances.” Enable when cost/hours/payer saved, **without** requiring `splitwiseId`.
- Bridge on: keep requiring `splitwiseId` for the Splitwise POST; if IDs missing, still offer “Record here only” only if you already wrote the ledger in a previous attempt. Simpler rule: if bridge on and IDs missing, show today’s missing-ID warning and do not call the API. Captain must fix IDs to dual-write. (Opening import already needs IDs.)

**MembersSection:** button “Import Splitwise balances” next to “Load from Splitwise”, `POST /api/ledger/import`, show created + skipped names.

- [ ] **Step 1: Wire SettleForm + import button + i18n.**

- [ ] **Step 2: Update `CLAUDE.md`** with `/balances`, `/api/ledger*`, and cutover note.

- [ ] **Step 3: `npx tsc --noEmit` && `npm test`** — expect exit 0 / all tests pass.

- [ ] **Step 4: Commit**

```bash
git add components/matches/SettleForm.tsx components/management CLAUDE.md lib/i18n
git commit -m "feat: record settle on ledger and import Splitwise opening balances"
```

---

## Manual test plan (after Task 8)

1. Bridge on (keys set). Management → Import Splitwise balances. `/balances` Group tab matches leftover Splitwise nets (simplified).
2. Settle a past match → Sync. Confirm `Expense` MATCH (+ SHUTTLECOCK if not singles) in DB and Splitwise. `/balances` updates.
3. Stop Splitwise (invalid key or offline): settle again on another match → ledger row exists, UI shows retry, no second MATCH row on retry after fixing the key.
4. Captain Mark paid on an edge → remainders drop; second click no-ops.
5. Unset `SPLITWISE_API_KEY`. Restart. Import hidden. Settle says Record expense. No Splitwise HTTP in network tab. `splitwiseId` not required.

---

## Spec coverage

| Spec item | Task |
| --- | --- |
| Expense + ExpenseShare model | 1 |
| Hybrid simplify + per-expense breakdown | 2, 6, 7 |
| FIFO mark-paid, idempotent | 2, 6 |
| Opening import, replace OPENING only | 3, 6, 8 |
| Dual-write, retry, no duplicate MATCH | 4, 5, 8 |
| Bridge off = unset keys | 5, 8 |
| `/balances` My + Group, no player Paid | 7 |
| Captain PIN Paid | 7 |
| Settle UX + management import | 8 |
| Shuttlecock two-party expense | 4 |
| DrinkDebt untouched | all |
| SaaS `groupId` later | queries stay unscoped; no column in v1 |
| i18n Sổ / Balances / 账本 | 7 |

## Out of this plan

Login, creditor-mark-paid, PayNow, multi-group, notifications, editing paid expenses, homepage “who am I”.
