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
