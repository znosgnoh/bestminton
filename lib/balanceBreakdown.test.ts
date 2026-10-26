import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  openRemittancesToMember,
  pairBreakdownItems,
  pairDirectRemainder,
  pairGrossBreakdownItems,
} from "./balanceBreakdown";
import type { LedgerExpenseDTO } from "./types";

function expense(
  partial: Partial<LedgerExpenseDTO> &
    Pick<LedgerExpenseDTO, "id" | "kind" | "paidByMemberId" | "paidByName" | "shares">
): LedgerExpenseDTO {
  return {
    matchId: 1,
    title: "Tuesday Night · 1 Jan 2026",
    amount: partial.shares.reduce((sum, s) => sum + s.owed, 0),
    currency: "SGD",
    status: "OPEN",
    splitwiseExpenseId: null,
    createdAt: "2026-01-01T12:00:00.000Z",
    ...partial,
  };
}

describe("pairGrossBreakdownItems", () => {
  it("shows court remittance as a credit against match shares", () => {
    const expenses = [
      expense({
        id: 1,
        kind: "MATCH",
        paidByMemberId: 10,
        paidByName: "Payer",
        shares: [
          {
            id: 1,
            expenseId: 1,
            memberId: 20,
            memberName: "Booker",
            owed: 20,
            paid: 0,
          },
        ],
      }),
      expense({
        id: 2,
        kind: "COURT",
        paidByMemberId: 20,
        paidByName: "Booker",
        createdAt: "2026-01-01T12:01:00.000Z",
        shares: [
          {
            id: 2,
            expenseId: 2,
            memberId: 10,
            memberName: "Payer",
            owed: 16.75,
            paid: 0,
          },
        ],
      }),
    ];

    const items = pairGrossBreakdownItems(expenses, 20, 10);
    assert.deepEqual(
      items.map((i) => ({ kind: i.kind, remainder: i.remainder })),
      [
        { kind: "MATCH", remainder: 20 },
        { kind: "COURT", remainder: -16.75 },
      ]
    );
    assert.equal(pairDirectRemainder(expenses, 20, 10), 20);
    assert.equal(pairBreakdownItems(expenses, 20, 10).length, 1);
  });
});

describe("openRemittancesToMember", () => {
  it("lists open court remittances owed to the booker", () => {
    const expenses = [
      expense({
        id: 2,
        kind: "COURT",
        paidByMemberId: 20,
        paidByName: "Booker",
        shares: [
          {
            id: 2,
            expenseId: 2,
            memberId: 10,
            memberName: "Payer",
            owed: 16.75,
            paid: 0,
          },
        ],
      }),
      expense({
        id: 3,
        kind: "MATCH",
        paidByMemberId: 10,
        paidByName: "Payer",
        shares: [
          {
            id: 3,
            expenseId: 3,
            memberId: 20,
            memberName: "Booker",
            owed: 20,
            paid: 0,
          },
        ],
      }),
    ];

    const rows = openRemittancesToMember(expenses, 20);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].debtorId, 10);
    assert.equal(rows[0].remainder, 16.75);
    assert.equal(openRemittancesToMember(expenses, 10).length, 0);
  });
});
