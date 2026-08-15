# Internal expense ledger (replace Splitwise)

**Date:** 2026-08-15  
**Status:** Approved for planning  
**Product:** Bestminton (single team now; SaaS later)

## Problem

Bestminton syncs court and shuttlecock expenses to Splitwise. The Splitwise API is free today and will be charged next month. The team must stop depending on that API by the end of August 2026 without losing a shared “who owes whom” tab.

Cost math, who paid, and the nước cam token ledger already live in the app. Splitwise is only used to import group members and to push expenses so people can see and settle money there.

## Goals

- Court money lives in Bestminton. Players can see what they owe. The captain can mark debts paid.
- This month: keep using Splitwise **and** show the same debts in-app (educate, migrate slowly).
- Month-end: turn off Splitwise calls. No paid API required for the team.
- Design the ledger so a future SaaS group can own it (`groupId`) without a rewrite of the money model.

## Non-goals (v1)

- Player login / OAuth.
- Creditor (or debtor) marking paid — captain only until identity exists.
- PayNow / payment-provider deep links.
- Multi-group / multi-tenant billing.
- Push notifications.
- Mixing court money with nước cam tokens.
- Editing or deleting an expense after any of its shares have been marked paid (v1: no mutate-after-pay).
- Rebuilding every historical Splitwise expense line-by-line. We import **current nets** as opening balances only.

## Decisions

| Topic | Choice |
| --- | --- |
| End state | Drop Splitwise; in-app balances; cash/PayNow stays outside the app |
| Balance model | Hybrid: per-match (and opening) breakdown + simplified running net |
| Mark paid (v1) | Captain only (PIN). Later: creditor, once identity exists |
| Identity (v1) | None. Players pick “I am …” to **view**. Money actions stay captain-gated |
| History | Import remaining Splitwise **group nets** as `OPENING` expenses |
| This month | Dual-write: ledger first, then Splitwise |
| Architecture | Expense + shares ledger (not a clone of `DrinkDebt`, not a fake Splitwise HTTP API) |

## Architecture

Postgres is the source of truth for court money. Splitwise is an optional **bridge**.

```
Settle (existing shares)
    → create Expense + ExpenseShares   (always)
    → if bridge on: POST Splitwise     (optional)
    → store splitwiseExpenseId on success

Import Splitwise nets
    → replace OPENING expenses only
    → do not touch MATCH / SHUTTLECOCK

Balances page
    → unpaid shares → pairwise nets → simplify
    → captain mark-paid applies FIFO to those shares
```

- **Nước cam** stays on `DrinkDebt` / `/cam`. Court ledger never writes drink tokens.
- v1 is one implicit group (this deployment). Every ledger query is written so a later `groupId` (or team id) can be added on `Expense` without changing share math.
- `Member.splitwiseId` remains through the bridge month. After cutover it is unused; do not drop the column in v1.
- `Match.synced` means “successfully pushed to Splitwise.” A match can be **recorded in the ledger** even when Splitwise push failed.

## Data model

### Expense

| Field | Notes |
| --- | --- |
| `id` | PK |
| `kind` | `MATCH` \| `SHUTTLECOCK` \| `OPENING` |
| `matchId` | Set for `MATCH` and `SHUTTLECOCK`; null for `OPENING` |
| `title` | e.g. match title + date, or “Splitwise opening” |
| `amount` | Positive decimal; must equal sum of shares after cent-fix |
| `currency` | Same as today’s `SPLITWISE_CURRENCY_CODE` / app currency (default SGD) |
| `paidByMemberId` | Creditor for this expense (Paid By, or shuttlecock recipient’s counterpart as today) |
| `status` | `OPEN` if any share still has `paid < owed`; else `SETTLED` |
| `splitwiseExpenseId` | Null until dual-write succeeds; stays as history after cutover |
| `createdAt` | |

Constraints:

- At most one `MATCH` expense per `matchId`.
- At most one `SHUTTLECOCK` expense per `matchId` (same skip rule as today: titles matching `/singles?/` do not create shuttlecock remittance).
- `OPENING` rows are not tied to a match. Re-import deletes/replaces **only** `kind = OPENING`.

### ExpenseShare

| Field | Notes |
| --- | --- |
| `expenseId` | FK |
| `memberId` | FK |
| `owed` | That member’s share of `Expense.amount` (2 decimal places) |
| `paid` | 0 ≤ `paid` ≤ `owed`. v1 mark-paid typically sets `paid = owed` for the shares consumed by a simplified edge |

The creditor is only `Expense.paidByMemberId`. That member does **not** get an `ExpenseShare` row. Every share is “this member owes the creditor `owed`.”

Shuttlecock remittance is a two-party expense: `paidByMemberId` is the **shuttlecock recipient** (creditor); the court payer has one share equal to the shuttlecock fee (same economics as today’s second Splitwise expense).

### Derived balances (not stored)

1. For each unpaid remainder `owed - paid` on a share, treat it as **member → paidBy** of that expense.
2. Net pairwise (A→B minus B→A).
3. Simplify with the same approach as drink-debt simplify (`lib/drinkDebtUtils.ts` pattern: collapse chains, do not invent edges across disconnected people).
4. Balances UI reads this graph. Mark-paid writes back to `ExpenseShare.paid`, then recompute.

Do not persist simplified edges as the source of truth. They are a view.

### Existing fields

- Keep `Match.totalCost`, `hours`, `paidByMemberId`, `shuttlecockRecipientMemberId`, `synced`.
- Keep `Member.splitwiseId` for the bridge month (required only when posting to Splitwise).
- After cutover, settle must **not** require `splitwiseId`.

## Captain and player flows

### Players (`/balances`, nav label e.g. Sổ / Balances)

- **My tab:** avatar picker (“I am …”), then net owed/owed-to-you and simplified rows (“You owe Bình $24”).
- **Group tab:** simplified who-owes-whom for the whole team (read-only). Same public-trust model as the kèo list.
- Row → breakdown: contributing expenses (match court, shuttlecock, Splitwise opening) with dates and amounts.
- No Paid control.

v1 does not add a “who am I” prompt on the homepage.

### Captain

- **Settle** (existing form): save cost/hours/payer as today.
- Record action:
  - Bridge **on:** button remains “Sync to Splitwise.” Writes ledger first, then Splitwise (court expense, plus shuttlecock remittance when applicable).
  - Bridge **off:** button is “Record expense.” Ledger only.
- If Splitwise fails after a successful ledger write: show “Saved here, Splitwise failed — retry.” Retry uses the existing expense; it must not create a second `MATCH` / `SHUTTLECOCK` row.
- **Balances:** same lists as players, plus **Mark paid** on a simplified edge. Requires captain PIN. Applies FIFO: oldest unpaid remainders that compose that creditor←debtor pair, until the edge amount is covered.
- **Management:** “Import Splitwise balances” while the bridge is on. Creates/replaces `OPENING` expenses from current Splitwise group nets. Disabled when the bridge is off.
- “Load from Splitwise” for members may stay during the bridge month and should be hidden or removed at cutover (members are already in Bestminton).

### Mark paid (v1)

- Only captain + PIN.
- Target: one simplified edge (debtor, creditor, amount).
- Effect: increase `ExpenseShare.paid` on the FIFO shares that explain that edge (same pair, unpaid remainder).
- If the displayed edge amount is fully covered, those remainders go to zero; expense `status` becomes `SETTLED` when all its shares are fully paid.
- Idempotent: repeating the same mark-paid when the edge is already gone is a no-op success, not a double payment.

## Bridge month and cutover

1. Ship ledger + `/balances` while Splitwise is still free.
2. Captain runs **Import Splitwise balances** once so the sổ matches Splitwise leftover nets.
3. New settles **dual-write** (ledger, then Splitwise).
4. Team is told: look at Bestminton; keep paying as they do today (often still via Splitwise).
5. Cutover: unset `SPLITWISE_API_KEY` / `SPLITWISE_GROUP_ID` or set an explicit bridge-off flag (implementation may use “not configured” as off — one mechanism, documented in env). Hide Sync/Import. Settle writes ledger only.
6. After cutover: zero Splitwise HTTP from the app.

Re-import before cutover: replace `OPENING` only. If a member’s leftover changed in Splitwise, the opening row updates; match expenses already in the ledger stay.

## Error handling

| Case | Behavior |
| --- | --- |
| Splitwise 4xx/5xx on sync | Ledger row remains; `splitwiseExpenseId` null; captain can retry |
| Splitwise 4xx/5xx on import | No partial replace of openings unless the pull fully parsed; show error |
| Import member not in Bestminton | Skip; list names to add or link `splitwiseId` in Management |
| Import member in Splitwise with ~0 net | No opening row |
| Mark paid without PIN when `CAPTAIN_PIN` set | 403/401 as other captain mutations |
| Rounding | Existing weighted-share formula + cent discrepancy on first participant so Σ owed = total |
| Duplicate settle record | Unique `matchId` + `kind` prevents a second court/shuttlecock expense |

## Testing

- Import: Splitwise-style nets map to opening shares; missing members reported; re-import replaces openings only.
- Dual-write: ledger exists when Splitwise returns 500; retry does not insert a second `MATCH` expense; success stores `splitwiseExpenseId`.
- Simplify: A↔B cancel; A→B and B→C may collapse to A→C; no edge invented across disconnected people.
- Mark paid: FIFO across mixed `OPENING` + `MATCH` + `SHUTTLECOCK` shares for the same pair; second call is idempotent.
- Cutover: with bridge off, settle and balances never call Splitwise.
- Shuttlecock: non-singles match creates two expenses; singles-title skip unchanged.

## Adoption (this team)

- Week of ship: import openings, dual-write, send the balances link in the team chat.
- Rest of August: captain still syncs to Splitwise so nobody is surprised; players start checking Bestminton.
- End of month: confirm openings + new sessions look right, flip bridge off, tell the team Splitwise is no longer updated.

## Future SaaS (not v1)

- Add `groupId` on `Expense` (and members/matches).
- Real login; then enable creditor-mark-paid (already decided as the long-term rule).
- Optional Splitwise export as a paid integration — not required for this team.

## Open implementation notes (not product TBD)

- Env: prefer treating “Splitwise not configured” as bridge off so cutover is removing keys, not a new concept captains must learn. If a flag is added, it must be documented in `CLAUDE.md` env section.
- Nav copy: Vietnamese **Sổ** / English **Balances** / Chinese to match existing i18n pattern.
- Reuse drink-debt simplify ideas; do not store court money in `DrinkDebt`.
