# Orange juice (nước cam) pool balance

**Date:** 2026-09-03  
**Status:** Approved for planning  
**Product:** Bestminton

## Problem

Nước cam is stored as pairwise `DrinkDebt` edges (`debtorId` → `creditorId`). `/cam` already shows net positions and suggested payments via `simplifyDebts`, but settle still reduces real edges (direct, then BFS path). That is harder to explain and maintain than a single shared pool.

The team wants one OJ pool: each person has one signed balance; settle moves glasses from someone with a surplus to someone with a deficit; the sum of all balances is always zero.

## Goals

- One signed `ojBalance` per member is the source of truth for nước cam.
- Positive = owns OJ (is owed that many ly). Negative = owes that many. Zero = clear.
- Settle: pick one positive member and one negative member; transfer up to `min(positive, |negative|)`.
- `SUM(ojBalance) = 0` after every mutate (resolve payouts, settle, rollback).
- Log settle transactions only (`A → B`, amount); captain can roll an active settle back.
- Members settle with member PIN; captain rolls back with captain PIN.
- One-shot migrate existing pairwise nets into `ojBalance`, then drop `DrinkDebt`.

## Non-goals

- Logging or rolling back kèo resolve payouts (Elo / drink awards stay as today: resolve adjusts balances only; challenge delete/edit winner does not reverse OJ).
- Keeping pairwise edges after cutover (no read-only archive of old edges).
- Changing court-money ledger / `/balances`.
- Rollback notification emails (settle notify stays; rollback email skipped).
- Player login / OAuth for settle identity.

## Decisions

| Topic | Choice |
| --- | --- |
| Storage | `Member.ojBalance` (Int, default 0) + `DrinkSettleTransaction` log |
| Sign | `+` = owns / is owed; `−` = owes (same as today’s `netCam = totalOwing − totalOwed`) |
| Settle log | Settle only — not resolve |
| Settle auth | Member PIN (`MEMBER_PIN`) |
| Rollback auth | Captain PIN (`CAPTAIN_PIN`) |
| Migration | Net each member from `DrinkDebt` → `ojBalance`, assert Σ = 0, drop `DrinkDebt` |
| Path settle / simplify for drinks | Remove as settle path; court ledger may still reuse pure helpers if needed |

## Architecture

```
Kèo resolve
  → adjustOjBalance winners/losers / bettors (Σ = 0)
  → no DrinkSettleTransaction row

Member settle (member PIN)
  → validate from.ojBalance > 0, to.ojBalance < 0
  → amount ∈ 1..min(from, −to)
  → from −= amount, to += amount
  → insert DrinkSettleTransaction (rolledBackAt = null)

Captain rollback (captain PIN)
  → active row only
  → from += amount, to −= amount
  → set rolledBackAt

GET /cam data
  → list members with ojBalance ≠ 0 (+ optional zeros omitted)
  → list settle transactions (active + rolled back)
```

Court money stays on `Expense` / `ExpenseShare`. Nước cam never writes court ledger rows.

## Data model

### `Member.ojBalance`

| Field | Type | Notes |
| --- | --- | --- |
| `ojBalance` | Int | Default `0`. Signed glasses in the shared pool |

Invariant: `SUM(Member.ojBalance) = 0` for all members.

### `DrinkSettleTransaction`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | Int PK | Auto-increment |
| `fromMemberId` | Int FK → Member | Positive side at settle time (owns OJ) |
| `toMemberId` | Int FK → Member | Negative side at settle time (owes) |
| `amount` | Int | `> 0` |
| `createdAt` | DateTime | |
| `rolledBackAt` | DateTime? | Null = active; set once on rollback |

No `rolledBackBy` in v1 (captain PIN is sufficient).

### Dropped

- Model `DrinkDebt` and relations `Member.debtsOwed` / `debtsOwing`.

### Migration (one-shot)

For each member:

```
ojBalance = Σ(amount where creditorId = member) − Σ(amount where debtorId = member)
```

That equals today’s `netCam`. Assert global sum is 0. Then drop `DrinkDebt`.

Existing settle history for old pairwise edges is not reconstructed.

## API

| Endpoint | Auth | Behavior |
| --- | --- | --- |
| `GET /api/debts` | open | `{ balances: OjBalanceDTO[], transactions: DrinkSettleTransactionDTO[] }` |
| `POST /api/debts/settle` | member PIN | Body `{ fromMemberId, toMemberId, amount?, pin }`. Default amount = max. Adjust balances + insert log. |
| `POST /api/debts/transactions/[id]/rollback` | captain PIN | Active row only. Reverse deltas + set `rolledBackAt`. `409` if already rolled back. |
| `GET /api/members/[id]/debts` | open | `{ ojBalance, summary, transactions?: ... }` compatible with profile/leaderboard needs |

`dataService.settleDebt` becomes pool settle (`fromMemberId` / `toMemberId`). Add `rollbackDrinkSettle(id, pin?)`.

### Validation & errors

- `400` — same from/to; amount ≤ 0; from not positive; to not negative; amount > max
- `401` / `403` — PIN missing/wrong
- `409` — insufficient balance at settle time (concurrent); already rolled back
- Assert Σ = 0 inside the DB transaction after mutations; treat failure as `500` (should be unreachable)

Settle and rollback run in a single Prisma transaction: re-read balances under the transaction before applying.

## Resolve (create OJ)

Replace `addDebt` usage in `challengeService` with pool adjustments that preserve Σ = 0:

| Case | Rule (unchanged product meaning) |
| --- | --- |
| Singles drink, no bets | Each loser `−= 1` per winner; each winner `+=` number of losers (or equivalent pairwise-neutral increments) |
| Doubles drink, no bets | Each winner `+= 1`; assign `−= 1` across losers (same round-robin spirit) |
| Bets present | Winner of stake `+= amount`; loser of stake `−= amount` (match drink awards still skipped when bets exist) |

`resolutionSnapshot.debts` can keep a human-readable record of who gained/lost how much for the kèo UI; it is not the live ledger.

Challenge delete / edit winner: still do **not** reverse `ojBalance` (same as today for `DrinkDebt`).

## UI (`/cam`)

- **Pool:** two groups — Owns (`ojBalance > 0`) and Owes (`ojBalance < 0`); all settled empty state.
- **Settle:** select one owner + one ower → amount (default max = `min`) → member PIN → confirm.
- **History:** settle list `from → to`, amount, time; rolled-back rows badge / struck through.
- **Rollback:** captain-only (prompt/unlock captain PIN); not shown to members without captain unlock.
- Remove Suggested vs Ledger modes, Direct/Net badges, pairwise table, path-settle messaging.

Leaderboard / member profile: `debtSummary.netCam` reads from `ojBalance` (`totalOwed` / `totalOwing` can be derived as `max(−oj,0)` / `max(oj,0)` for display compatibility).

## Emails

- Keep `notifyDrinkDebtSettled` on successful settle (from / to / amount).
- No rollback email in v1.

## Member delete

Block deleting a member with `ojBalance !== 0` (must settle to zero first). Update API error copy accordingly.

## Testing

- Unit: balance adjust helpers; settle max; rollback reverse; checksum; migration nets from sample edges.
- Resolve: singles / doubles / bets update `ojBalance` without creating settle rows; Σ = 0.
- API: settle happy path; reject bad signs; rollback once then 409; concurrent insufficient balance.
- UI smoke: pool groups, settle max, history + captain rollback.

## Out of scope / later

- Audit of resolve payouts and reverse-on-challenge-edit.
- Soft-archive of pre-migration pairwise edges.
- Rollback emails.
