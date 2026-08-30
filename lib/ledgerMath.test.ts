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
  it("nets A↔B but keeps A→B and B→C as direct pairs so both can be marked paid", () => {
    const edges = ledgerSimplifiedEdges([
      { debtorId: 1, creditorId: 2, remainder: 10 },
      { debtorId: 2, creditorId: 1, remainder: 4 },
      { debtorId: 2, creditorId: 3, remainder: 6 },
    ]);
    const sorted = [...edges].sort((a, b) => a.debtorId - b.debtorId);
    assert.deepEqual(sorted, [
      { debtorId: 1, creditorId: 2, amount: 6 },
      { debtorId: 2, creditorId: 3, amount: 6 },
    ]);
  });

  it("does not invent edges across disconnected people", () => {
    const edges = ledgerSimplifiedEdges([
      { debtorId: 1, creditorId: 2, remainder: 5 },
      { debtorId: 3, creditorId: 4, remainder: 5 },
    ]);
    assert.equal(edges.length, 2);
  });

  it("keeps court shares and shuttlecock remittance as direct pairs", () => {
    const edges = ledgerSimplifiedEdges([
      { debtorId: 3, creditorId: 1, remainder: 7.94 },
      { debtorId: 2, creditorId: 1, remainder: 7.94 },
      { debtorId: 1, creditorId: 2, remainder: 37.5 },
    ]);
    const byPair = new Map(edges.map((e) => [`${e.debtorId}:${e.creditorId}`, e.amount]));
    assert.equal(byPair.get("3:1"), 7.94);
    assert.equal(byPair.get("1:2"), 29.56);
    assert.equal(byPair.has("3:2"), false);
  });

  it("rounds float remainders to cents", () => {
    const edges = ledgerSimplifiedEdges([
      { debtorId: 8, creditorId: 1, remainder: 7.939999999999999 },
      { debtorId: 1, creditorId: 2, remainder: 37.5 },
    ]);
    assert.deepEqual(
      edges.find((e) => e.debtorId === 8),
      { debtorId: 8, creditorId: 1, amount: 7.94 }
    );
  });

  it("drops pairs that cancel exactly (shuttlecock vs match shares)", () => {
    // Production SonHo ↔ phương: $45 shuttlecock offset by $45 of match remainders.
    // Float sum left ~1e-15 and used to show SonHo → phương · S$0.00 with a $45 breakdown.
    const edges = ledgerSimplifiedEdges([
      { debtorId: 8, creditorId: 1, remainder: 1.58 },
      { debtorId: 8, creditorId: 1, remainder: 15.88 },
      { debtorId: 1, creditorId: 8, remainder: 45 },
      { debtorId: 8, creditorId: 1, remainder: 8.52 },
      { debtorId: 8, creditorId: 1, remainder: 7.79 },
      { debtorId: 8, creditorId: 1, remainder: 4.88 },
      { debtorId: 8, creditorId: 1, remainder: 6.35 },
    ]);
    assert.equal(
      edges.filter((e) => (e.debtorId === 1 && e.creditorId === 8) || (e.debtorId === 8 && e.creditorId === 1))
        .length,
      0
    );
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
