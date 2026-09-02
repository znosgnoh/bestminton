# OJ Pool Balance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace pairwise `DrinkDebt` with a shared `Member.ojBalance` pool, settle positive→negative with a settle log, and allow captain rollback.

**Architecture:** Signed `ojBalance` per member is the source of truth (`+` owns / is owed, `−` owes). Kèo resolve adjusts balances with Σ = 0 and no settle row. Member settle writes `DrinkSettleTransaction` and moves balances toward zero. Captain rollback reverses one active settle row. One-shot migration nets old edges into `ojBalance` then drops `DrinkDebt`.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript · Prisma · Vercel Postgres · TailwindCSS v4 · `tsx --test` (`npm test`)

**Spec:** `docs/superpowers/specs/2026-09-03-oj-pool-balance-design.md`

## Global Constraints

- Read `node_modules/next/dist/docs/` before new App Router code (Next.js 16).
- Sign convention: `ojBalance > 0` = owns OJ (same as today’s `netCam = totalOwing − totalOwed`); `< 0` = owes.
- After every mutate: `SUM(Member.ojBalance) = 0` (assert inside the Prisma transaction).
- Settle log only — never create `DrinkSettleTransaction` from kèo resolve.
- Settle auth: `requireMemberPin` / `MEMBER_PIN`. Rollback auth: `requireAdminPin` / `CAPTAIN_PIN`.
- Court ledger keeps using `lib/drinkDebtUtils.ts` (`DebtEdge`, `netBilateralDebts`, `simplifyDebts`). Do not break `/balances`.
- i18n: add/update keys in `en.ts`, `vi.ts`, and `zh.ts`.
- Tests: `npm test` → `tsx --test 'lib/**/*.test.ts'`.
- Challenge delete / edit winner still does **not** reverse `ojBalance`.
- No rollback email in v1; keep settle email.

---

## File tree

```
bestminton/
├── prisma/schema.prisma                                      [UPDATE]
├── prisma/migrations/20260903120000_oj_pool_balance/         [NEW]
├── lib/
│   ├── types.ts                                              [UPDATE]
│   ├── ojBalance.ts                                          [NEW] pool adjust / settle / rollback / summaries
│   ├── ojBalance.test.ts                                     [NEW]
│   ├── drinkDebt.ts                                          [DELETE or gut → re-export from ojBalance during cutover]
│   ├── drinkDebtUtils.ts                                     [KEEP] court ledger
│   ├── drinkDebtUtils.test.ts                                [KEEP]
│   ├── challengeService.ts                                   [UPDATE] use creditOj / debit via transferOj
│   ├── memberSerialize.ts                                    [UPDATE]
│   ├── dataService.ts                                        [UPDATE]
│   ├── email/events.ts                                       [UPDATE] settle notify field names if needed
│   └── i18n/messages/{en,vi,zh}.ts                           [UPDATE]
├── app/
│   ├── api/debts/route.ts                                    [UPDATE] pool snapshot
│   ├── api/debts/settle/route.ts                             [UPDATE] from/to pool settle
│   ├── api/debts/transactions/[id]/rollback/route.ts         [NEW]
│   ├── api/members/[id]/debts/route.ts                       [UPDATE]
│   ├── api/members/[id]/route.ts                             [UPDATE] DELETE gate on ojBalance
│   └── cam/
│       ├── CamLoader.tsx                                     [UPDATE]
│       └── CamPageClient.tsx                                 [UPDATE]
├── components/cam/
│   ├── DebtsTable.tsx                                        [REPLACE] → OjPoolPanel (or rewrite in place)
│   ├── SettleAmountModal.tsx                                 [UPDATE] from/to labels
│   └── SettleHistory.tsx                                     [NEW] optional split from panel
├── CLAUDE.md                                                 [UPDATE] DrinkDebt → ojBalance
└── docs/superpowers/specs/2026-09-03-oj-pool-balance-design.md [REF]
```

---

### Task 1: Schema + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260903120000_oj_pool_balance/migration.sql`

**Interfaces:**
- Produces: `Member.ojBalance: Int @default(0)`; model `DrinkSettleTransaction`; `DrinkDebt` removed from schema after migration SQL runs

- [ ] **Step 1: Update Prisma schema**

On `Member`, add:

```prisma
ojBalance Int @default(0)

settleFrom DrinkSettleTransaction[] @relation("SettleFrom")
settleTo   DrinkSettleTransaction[] @relation("SettleTo")
```

Remove `debtsOwed` / `debtsOwing` and the entire `DrinkDebt` model.

Add:

```prisma
model DrinkSettleTransaction {
  id           Int       @id @default(autoincrement())
  fromMemberId Int
  toMemberId   Int
  amount       Int
  createdAt    DateTime  @default(now())
  rolledBackAt DateTime?

  fromMember Member @relation("SettleFrom", fields: [fromMemberId], references: [id])
  toMember   Member @relation("SettleTo", fields: [toMemberId], references: [id])

  @@index([createdAt])
  @@index([rolledBackAt])
}
```

- [ ] **Step 2: Write migration SQL**

```sql
-- AlterTable
ALTER TABLE "Member" ADD COLUMN "ojBalance" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "DrinkSettleTransaction" (
    "id" SERIAL NOT NULL,
    "fromMemberId" INTEGER NOT NULL,
    "toMemberId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rolledBackAt" TIMESTAMP(3),
    CONSTRAINT "DrinkSettleTransaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DrinkSettleTransaction_createdAt_idx" ON "DrinkSettleTransaction"("createdAt");
CREATE INDEX "DrinkSettleTransaction_rolledBackAt_idx" ON "DrinkSettleTransaction"("rolledBackAt");

ALTER TABLE "DrinkSettleTransaction" ADD CONSTRAINT "DrinkSettleTransaction_fromMemberId_fkey"
  FOREIGN KEY ("fromMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DrinkSettleTransaction" ADD CONSTRAINT "DrinkSettleTransaction_toMemberId_fkey"
  FOREIGN KEY ("toMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Net migrate from pairwise DrinkDebt (creditor +amount, debtor -amount)
UPDATE "Member" m
SET "ojBalance" = COALESCE((
  SELECT
    COALESCE((SELECT SUM(d."amount") FROM "DrinkDebt" d WHERE d."creditorId" = m."id"), 0)
    - COALESCE((SELECT SUM(d."amount") FROM "DrinkDebt" d WHERE d."debtorId" = m."id"), 0)
), 0);

-- Safety: fail migration if checksum ≠ 0 (Postgres DO block)
DO $$
DECLARE s INTEGER;
BEGIN
  SELECT COALESCE(SUM("ojBalance"), 0) INTO s FROM "Member";
  IF s <> 0 THEN
    RAISE EXCEPTION 'ojBalance checksum % != 0 after DrinkDebt migration', s;
  END IF;
END $$;

DROP TABLE "DrinkDebt";
```

- [ ] **Step 3: Generate client**

Run: `npx prisma generate`  
Expected: client includes `ojBalance` and `drinkSettleTransaction`, no `drinkDebt`.

- [ ] **Step 4: Apply locally (when DB available)**

Run: `npx prisma migrate deploy`  
Expected: migration applies; `SUM(ojBalance) = 0`.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260903120000_oj_pool_balance
git commit -m "feat(db): migrate drink debts to Member.ojBalance pool"
```

---

### Task 2: Core pool helpers + unit tests

**Files:**
- Create: `lib/ojBalance.ts`
- Create: `lib/ojBalance.test.ts`
- Modify: `lib/types.ts` (DTOs used by helpers)

**Interfaces:**
- Produces:
  - `summaryFromOjBalance(oj: number): MemberDebtSummary`
  - `assertOjChecksum(tx): Promise<void>`
  - `transferOj(fromId, toId, amount, tx): Promise<void>` — creditor gains, debtor loses (resolve path: creditor = winner)
  - `settleOjPool({ fromMemberId, toMemberId, amount? }, tx?): Promise<SettleOjResult>`
  - `rollbackOjSettle(transactionId, tx?): Promise<DrinkSettleTransactionDTO>`
  - `getOjPoolSnapshot(): Promise<OjPoolSnapshotDTO>`
  - `getAllDebtSummaries(): Promise<Map<number, MemberDebtSummary>>` (from `ojBalance`)
  - `debtSummaryFor` (same signature as today)

- [ ] **Step 1: Add DTOs to `lib/types.ts`**

```ts
export interface OjBalanceDTO {
  memberId: number;
  name: string;
  avatarUrl: string | null;
  ojBalance: number;
}

export interface DrinkSettleTransactionDTO {
  id: number;
  fromMemberId: number;
  toMemberId: number;
  fromName: string;
  toName: string;
  amount: number;
  createdAt: string;
  rolledBackAt: string | null;
}

export interface OjPoolSnapshotDTO {
  balances: OjBalanceDTO[];
  transactions: DrinkSettleTransactionDTO[];
}

export interface SettleOjRequest {
  fromMemberId: number;
  toMemberId: number;
  amount?: number;
  pin?: string;
}

export interface SettleOjResult {
  settled: number;
  remaining: number;
  transaction: DrinkSettleTransactionDTO;
  reason?: string;
}

/** @deprecated Prefer SettleOjRequest — keep briefly if any client still sends debtor/creditor */
export interface SettleDebtRequest {
  fromMemberId?: number;
  toMemberId?: number;
  debtorId?: number;
  creditorId?: number;
  amount?: number;
  pin?: string;
}
```

Keep `MemberDebtSummary` as `{ totalOwed, totalOwing, netCam }`.

- [ ] **Step 2: Write failing tests in `lib/ojBalance.test.ts`**

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { summaryFromOjBalance, maxSettleAmount } from "./ojBalance";

describe("summaryFromOjBalance", () => {
  it("maps positive to owing / netCam", () => {
    assert.deepEqual(summaryFromOjBalance(3), {
      totalOwed: 0,
      totalOwing: 3,
      netCam: 3,
    });
  });
  it("maps negative to owed", () => {
    assert.deepEqual(summaryFromOjBalance(-2), {
      totalOwed: 2,
      totalOwing: 0,
      netCam: -2,
    });
  });
});

describe("maxSettleAmount", () => {
  it("is min of positive and |negative|", () => {
    assert.equal(maxSettleAmount(5, -3), 3);
    assert.equal(maxSettleAmount(2, -9), 2);
    assert.equal(maxSettleAmount(0, -1), 0);
    assert.equal(maxSettleAmount(4, 1), 0);
  });
});
```

- [ ] **Step 3: Run tests — expect FAIL**

Run: `npm test -- lib/ojBalance.test.ts`  
Expected: FAIL module not found / exports missing.

- [ ] **Step 4: Implement `lib/ojBalance.ts` (pure + DB)**

```ts
import { Prisma } from "@prisma/client";
import { db } from "./db";
import type {
  DrinkSettleTransactionDTO,
  MemberDebtSummary,
  OjBalanceDTO,
  OjPoolSnapshotDTO,
  SettleOjResult,
} from "./types";

type Tx = Prisma.TransactionClient;

export function summaryFromOjBalance(ojBalance: number): MemberDebtSummary {
  const totalOwing = Math.max(ojBalance, 0);
  const totalOwed = Math.max(-ojBalance, 0);
  return { totalOwed, totalOwing, netCam: ojBalance };
}

export function maxSettleAmount(fromBalance: number, toBalance: number): number {
  if (fromBalance <= 0 || toBalance >= 0) return 0;
  return Math.min(fromBalance, -toBalance);
}

export async function assertOjChecksum(client: Tx = db): Promise<void> {
  const agg = await client.member.aggregate({ _sum: { ojBalance: true } });
  const sum = agg._sum.ojBalance ?? 0;
  if (sum !== 0) {
    throw new Error(`ojBalance checksum ${sum} != 0`);
  }
}

/** Resolve-style transfer: debtor loses OJ (more negative), creditor gains (more positive). */
export async function transferOj(
  debtorId: number,
  creditorId: number,
  amount: number,
  tx: Tx
): Promise<void> {
  if (debtorId === creditorId || amount <= 0) return;
  await tx.member.update({
    where: { id: debtorId },
    data: { ojBalance: { decrement: amount } },
  });
  await tx.member.update({
    where: { id: creditorId },
    data: { ojBalance: { increment: amount } },
  });
}

function toTxDto(
  row: {
    id: number;
    fromMemberId: number;
    toMemberId: number;
    amount: number;
    createdAt: Date;
    rolledBackAt: Date | null;
    fromMember: { name: string };
    toMember: { name: string };
  }
): DrinkSettleTransactionDTO {
  return {
    id: row.id,
    fromMemberId: row.fromMemberId,
    toMemberId: row.toMemberId,
    fromName: row.fromMember.name,
    toName: row.toMember.name,
    amount: row.amount,
    createdAt: row.createdAt.toISOString(),
    rolledBackAt: row.rolledBackAt?.toISOString() ?? null,
  };
}

export async function settleOjPool(
  input: { fromMemberId: number; toMemberId: number; amount?: number },
  tx?: Tx
): Promise<SettleOjResult> {
  const run = async (client: Tx): Promise<SettleOjResult> => {
    const { fromMemberId, toMemberId } = input;
    if (fromMemberId === toMemberId) {
      return {
        settled: 0,
        remaining: 0,
        reason: "same_member",
        transaction: null as unknown as DrinkSettleTransactionDTO,
      };
    }

    const [from, to] = await Promise.all([
      client.member.findUniqueOrThrow({ where: { id: fromMemberId } }),
      client.member.findUniqueOrThrow({ where: { id: toMemberId } }),
    ]);

    const max = maxSettleAmount(from.ojBalance, to.ojBalance);
    const requested =
      input.amount == null ? max : Math.max(0, Math.floor(input.amount));
    if (max <= 0 || requested <= 0) {
      throw Object.assign(new Error("No settleable amount."), {
        code: "NO_BALANCE",
      });
    }
    if (requested > max) {
      throw Object.assign(new Error("amount exceeds max settle"), {
        code: "INSUFFICIENT",
        max,
      });
    }

    await client.member.update({
      where: { id: fromMemberId },
      data: { ojBalance: { decrement: requested } },
    });
    await client.member.update({
      where: { id: toMemberId },
      data: { ojBalance: { increment: requested } },
    });

    const row = await client.drinkSettleTransaction.create({
      data: {
        fromMemberId,
        toMemberId,
        amount: requested,
      },
      include: {
        fromMember: { select: { name: true } },
        toMember: { select: { name: true } },
      },
    });

    await assertOjChecksum(client);

    return {
      settled: requested,
      remaining: 0,
      transaction: toTxDto(row),
    };
  };

  if (tx) return run(tx);
  return db.$transaction(run);
}

export async function rollbackOjSettle(
  transactionId: number,
  tx?: Tx
): Promise<DrinkSettleTransactionDTO> {
  const run = async (client: Tx) => {
    const row = await client.drinkSettleTransaction.findUnique({
      where: { id: transactionId },
      include: {
        fromMember: { select: { name: true } },
        toMember: { select: { name: true } },
      },
    });
    if (!row) {
      throw Object.assign(new Error("Transaction not found."), { code: "NOT_FOUND" });
    }
    if (row.rolledBackAt) {
      throw Object.assign(new Error("Already rolled back."), { code: "ALREADY_ROLLED_BACK" });
    }

    await client.member.update({
      where: { id: row.fromMemberId },
      data: { ojBalance: { increment: row.amount } },
    });
    await client.member.update({
      where: { id: row.toMemberId },
      data: { ojBalance: { decrement: row.amount } },
    });

    const updated = await client.drinkSettleTransaction.update({
      where: { id: transactionId },
      data: { rolledBackAt: new Date() },
      include: {
        fromMember: { select: { name: true } },
        toMember: { select: { name: true } },
      },
    });

    await assertOjChecksum(client);
    return toTxDto(updated);
  };

  if (tx) return run(tx);
  return db.$transaction(run);
}

export async function getAllDebtSummaries(): Promise<Map<number, MemberDebtSummary>> {
  const members = await db.member.findMany({ select: { id: true, ojBalance: true } });
  const map = new Map<number, MemberDebtSummary>();
  for (const m of members) {
    map.set(m.id, summaryFromOjBalance(m.ojBalance));
  }
  return map;
}

export function debtSummaryFor(
  memberId: number,
  summaries: Map<number, MemberDebtSummary>
): MemberDebtSummary {
  return summaries.get(memberId) ?? { totalOwed: 0, totalOwing: 0, netCam: 0 };
}

export async function getOjPoolSnapshot(): Promise<OjPoolSnapshotDTO> {
  const members = await db.member.findMany({
    where: { ojBalance: { not: 0 } },
    select: { id: true, name: true, avatarUrl: true, ojBalance: true },
    orderBy: [{ ojBalance: "desc" }, { name: "asc" }],
  });
  const transactions = await db.drinkSettleTransaction.findMany({
    include: {
      fromMember: { select: { name: true } },
      toMember: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return {
    balances: members.map(
      (m): OjBalanceDTO => ({
        memberId: m.id,
        name: m.name,
        avatarUrl: m.avatarUrl,
        ojBalance: m.ojBalance,
      })
    ),
    transactions: transactions.map(toTxDto),
  };
}
```

Fix `settleOjPool` same-member path to throw `400`-friendly error instead of a fake transaction (route handles `code`). Prefer throwing `{ code: "SAME_MEMBER" }` for consistency.

- [ ] **Step 5: Run pure unit tests — expect PASS**

Run: `npm test -- lib/ojBalance.test.ts`  
Expected: PASS for `summaryFromOjBalance` and `maxSettleAmount`.

- [ ] **Step 6: Commit**

```bash
git add lib/ojBalance.ts lib/ojBalance.test.ts lib/types.ts
git commit -m "feat: add ojBalance pool helpers and settle/rollback"
```

---

### Task 3: Wire kèo resolve to pool transfers

**Files:**
- Modify: `lib/challengeService.ts`
- Delete or thin: `lib/drinkDebt.ts` (remove `addDebt` usages; if anything still imports settle from it, re-export from `ojBalance` temporarily)

**Interfaces:**
- Consumes: `transferOj(debtorId, creditorId, amount, tx)`
- Produces: same `ChallengeDebtRecord[]` snapshot shape for UI (debtor/creditor/amount/reason)

- [ ] **Step 1: Replace `addDebt` imports**

```ts
import { transferOj } from "./ojBalance";
```

In `recordSinglesMatchDebts`, `recordDoublesMatchDebts`, `recordBetDebts`: replace `await addDebt(debtor, creditor, amount, tx)` with `await transferOj(debtor, creditor, amount, tx)`.

Keep pushing the same `ChallengeDebtRecord` objects for `resolutionSnapshot.debts`.

- [ ] **Step 2: Optionally assert checksum at end of resolve transaction**

After recording debts inside the resolve `db.$transaction`, call `await assertOjChecksum(tx)`.

- [ ] **Step 3: Remove dead pairwise settle code**

Delete `lib/drinkDebt.ts` once no imports remain. Update `memberSerialize.ts` to import `getAllDebtSummaries` / `debtSummaryFor` from `./ojBalance`.

- [ ] **Step 4: Commit**

```bash
git add lib/challengeService.ts lib/memberSerialize.ts lib/drinkDebt.ts
git commit -m "feat: record kèo nước cam on ojBalance pool"
```

---

### Task 4: API routes

**Files:**
- Modify: `app/api/debts/route.ts`
- Modify: `app/api/debts/settle/route.ts`
- Create: `app/api/debts/transactions/[id]/rollback/route.ts`
- Modify: `app/api/members/[id]/debts/route.ts`
- Modify: `app/api/members/[id]/route.ts` (DELETE)
- Modify: `lib/dataService.ts`
- Modify: `lib/email/events.ts` if settle notify still uses debtor/creditor names

**Interfaces:**
- Consumes: `getOjPoolSnapshot`, `settleOjPool`, `rollbackOjSettle`, `summaryFromOjBalance`
- Produces: REST shapes from the spec

- [ ] **Step 1: `GET /api/debts`**

```ts
import { getOjPoolSnapshot } from "@/lib/ojBalance";
// ...
return NextResponse.json(await getOjPoolSnapshot());
```

- [ ] **Step 2: `POST /api/debts/settle`**

Accept `fromMemberId` + `toMemberId` (also accept legacy `creditorId`/`debtorId` mapped as from=creditor, to=debtor for one release if needed).

```ts
const fromMemberId = Number(body.fromMemberId ?? body.creditorId);
const toMemberId = Number(body.toMemberId ?? body.debtorId);
// requireMemberPin
// settleOjPool → map thrown codes to 400/409
// notifyDrinkDebtSettled({ debtorId: toMemberId, creditorId: fromMemberId, settledAmount })
```

- [ ] **Step 3: Rollback route**

`app/api/debts/transactions/[id]/rollback/route.ts`:

```ts
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unavailable = requireDatabase();
  if (unavailable) return unavailable;
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid transaction id." }, { status: 400 });
  }
  let body: { pin?: string } = {};
  try {
    body = await request.json();
  } catch {
    /* empty body ok if header pin */
  }
  const pinDenied = requireAdminPin(pinFromRequest(request, body));
  if (pinDenied) return pinDenied;

  try {
    const tx = await rollbackOjSettle(id);
    revalidateDebtPages();
    return NextResponse.json(tx);
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "NOT_FOUND") return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (code === "ALREADY_ROLLED_BACK") {
      return NextResponse.json({ error: "Already rolled back." }, { status: 409 });
    }
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }
}
```

- [ ] **Step 4: Member debts + delete**

`GET /api/members/[id]/debts`: return `{ member, ojBalance, summary: summaryFromOjBalance(oj), owes: [], owedBy: [] }` (empty arrays OK for old clients) or drop owes/owedBy if profile only uses `summary`.

`DELETE /api/members/[id]`:

```ts
const member = await db.member.findUnique({
  where: { id },
  select: { id: true, ojBalance: true },
});
if (member.ojBalance !== 0) {
  return NextResponse.json(
    { error: "Member has outstanding orange juice — settle to zero first." },
    { status: 409 }
  );
}
// inside transaction: deleteMany DrinkSettleTransaction where from or to = id
// remove drinkDebt.deleteMany
```

- [ ] **Step 5: `dataService`**

```ts
export function getDebts(): Promise<OjPoolSnapshotDTO> {
  return challengeFetch<OjPoolSnapshotDTO>("/api/debts");
}

export function settleDebt(data: SettleOjRequest & { pin?: string }): Promise<SettleOjResult> {
  return challengeFetch<SettleOjResult>("/api/debts/settle", {
    method: "POST",
    headers: { ...JSON_HEADERS, ...memberPinHeaders() },
    body: JSON.stringify(withMemberPin(data)),
  });
}

export function rollbackDrinkSettle(id: number, pin?: string): Promise<DrinkSettleTransactionDTO> {
  return challengeFetch(`/api/debts/transactions/${id}/rollback`, {
    method: "POST",
    headers: { ...JSON_HEADERS, ...adminPinHeaders() },
    body: JSON.stringify(withAdminPin({ pin })),
  });
}
```

- [ ] **Step 6: Commit**

```bash
git add app/api/debts app/api/members lib/dataService.ts lib/email/events.ts
git commit -m "feat(api): OJ pool snapshot, settle, and captain rollback"
```

---

### Task 5: `/cam` UI rewrite

**Files:**
- Modify: `app/cam/CamLoader.tsx`, `app/cam/CamPageClient.tsx`
- Rewrite: `components/cam/DebtsTable.tsx` (or rename to `OjPoolPanel.tsx` and update imports)
- Modify: `components/cam/SettleAmountModal.tsx`
- Modify: `lib/i18n/messages/{en,vi,zh}.ts`

**Interfaces:**
- Consumes: `OjPoolSnapshotDTO`, `settleDebt({ fromMemberId, toMemberId, amount })`, `rollbackDrinkSettle`
- Produces: pool groups + settle picker + history with captain rollback

- [ ] **Step 1: Update i18n keys**

Add/replace in all three locales (examples in EN):

```ts
cam: {
  title: "Orange juice",
  subtitle: "Shared drink-token pool",
  dbRequired: "Orange juice requires a live database connection.",
  allSettled: "All settled — balances are zero.",
  ownsHeading: "Owns (owed)",
  owesHeading: "Owes",
  poolSummary: "{owns} own · {owes} owe · {total} ly outstanding",
  settleTitle: "Settle orange juice",
  settlePickFrom: "Who owns",
  settlePickTo: "Who owes",
  settleMax: "Max {amount} ly",
  historyHeading: "Settle history",
  rolledBack: "Rolled back",
  rollback: "Rollback",
  rollbackConfirm: "Roll back this settle of {amount} ly?",
  pinRollbackTitle: "Captain PIN to rollback",
  ly: "{amount} ly",
  // remove unused path/ledger mode keys or leave unused
}
```

Mirror VI/ZH.

- [ ] **Step 2: Loader + page client**

`CamLoader` fetches `getDebts()` → `OjPoolSnapshotDTO`.  
`CamPageClient` holds `snapshot`, refresh on settle/rollback, show pool summary from non-zero balances (`total outstanding = sum of positives`).

- [ ] **Step 3: Pool panel UI**

Replace pairwise `DebtsTable` with:

1. Two lists: `balances.filter(b => b.ojBalance > 0)` and `< 0`
2. Settle CTA when both lists non-empty: select from + to → `SettleAmountModal` with `max = min(from.ojBalance, -to.ojBalance)` → member PIN → `dataService.settleDebt`
3. History list of `transactions`; active rows show Rollback if `useAdminPin().unlocked` (or prompt `AdminPinModal`); call `rollbackDrinkSettle`
4. Highlight `?member=` still works by scrolling/emphasizing that member’s row

Remove: Suggested/Ledger modes, Direct/Net badges, path errors, `simplifyDebts` usage on cam page.

- [ ] **Step 4: Manual smoke**

With DB: resolve a drink kèo → balances move; settle max; checksum via SQL `SELECT SUM("ojBalance") FROM "Member"`; captain rollback restores; second rollback 409.

- [ ] **Step 5: Commit**

```bash
git add app/cam components/cam lib/i18n/messages
git commit -m "feat(ui): cam page pool settle and settle history"
```

---

### Task 6: Docs + leftover cleanup

**Files:**
- Modify: `CLAUDE.md` (DrinkDebt → ojBalance pool; settle/rollback APIs)
- Grep and fix any remaining `DrinkDebt` / `settleDebtBetween` / `getAllDebts` pairwise imports
- Keep `lib/drinkDebtUtils.ts` for court ledger

- [ ] **Step 1: Grep cleanup**

Run: `rg "drinkDebt|DrinkDebt|settleDebtBetween|getAllDebts|debtsOwed" --glob '!docs/**' --glob '!prisma/migrations/**'`  
Fix every remaining code reference.

- [ ] **Step 2: Update CLAUDE.md**

Replace DrinkDebt section with:

- `Member.ojBalance` shared pool; Σ = 0
- Settle: positive → negative, log `DrinkSettleTransaction`
- `POST /api/debts/settle` (member PIN), `POST /api/debts/transactions/[id]/rollback` (captain PIN)
- `/cam` shows pool + history

- [ ] **Step 3: Full test suite**

Run: `npm test`  
Expected: all pass (including existing `drinkDebtUtils` + new `ojBalance` tests).

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md lib app components
git commit -m "docs: update nước cam pool model in CLAUDE.md"
```

---

## Self-review checklist (planner)

| Spec requirement | Task |
| --- | --- |
| `Member.ojBalance` + settle log | Task 1 |
| Sign + Σ = 0 | Tasks 1–2 |
| Settle min(pos, \|neg\|) + log | Tasks 2, 4 |
| Captain rollback | Tasks 2, 4–5 |
| Member PIN settle | Task 4–5 |
| Resolve adjusts balances, no settle row | Task 3 |
| One-shot net migrate, drop edges | Task 1 |
| `/cam` pool UI + history | Task 5 |
| Block delete if nonzero OJ | Task 4 |
| Court ledger untouched utils | Global + Task 6 |
| No rollback email | Task 4 (omit) |

No TBD placeholders. `fromMemberId` = positive (owns); `toMemberId` = negative (owes); resolve still uses debtor/creditor language via `transferOj(debtor, creditor, amount)`.
