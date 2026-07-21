import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canPathSettle,
  debtAmountOnPath,
  findDebtPath,
  isDirectPairwiseDebt,
  isSettleableSuggestedEdge,
  simplifyDebts,
  type DebtEdge,
} from "./drinkDebtUtils";

describe("simplifyDebts", () => {
  it("collapses a chain while preserving nets", () => {
    const ledger: DebtEdge[] = [
      { debtorId: 1, creditorId: 2, amount: 1 },
      { debtorId: 2, creditorId: 3, amount: 1 },
    ];
    const simplified = simplifyDebts(ledger);
    assert.deepEqual(simplified, [{ debtorId: 1, creditorId: 3, amount: 1 }]);
  });

  it("only auto-balances within connected components", () => {
    const ledger: DebtEdge[] = [
      { debtorId: 1, creditorId: 30, amount: 5 },
      { debtorId: 2, creditorId: 10, amount: 5 },
    ];
    const simplified = simplifyDebts(ledger);
    // Two unrelated pairs stay as-is — no invented 1→10 / 2→30.
    assert.deepEqual(
      simplified.sort((a, b) => a.debtorId - b.debtorId),
      [
        { debtorId: 1, creditorId: 30, amount: 5 },
        { debtorId: 2, creditorId: 10, amount: 5 },
      ]
    );
    assert.equal(isSettleableSuggestedEdge(ledger, simplified[0]), true);
    assert.equal(isSettleableSuggestedEdge(ledger, simplified[1]), true);
  });

  it("still collapses chains that share a person", () => {
    const ledger: DebtEdge[] = [
      { debtorId: 1, creditorId: 2, amount: 1 }, // Vu Anh → Queenie
      { debtorId: 2, creditorId: 3, amount: 1 }, // Queenie → Alice
    ];
    assert.deepEqual(simplifyDebts(ledger), [{ debtorId: 1, creditorId: 3, amount: 1 }]);
  });
});

describe("path helpers", () => {
  it("finds a multi-hop path and capacity", () => {
    const ledger: DebtEdge[] = [
      { debtorId: 1, creditorId: 2, amount: 4 },
      { debtorId: 2, creditorId: 3, amount: 3 },
      { debtorId: 3, creditorId: 4, amount: 5 },
    ];
    const path = findDebtPath(ledger, 1, 4);
    assert.deepEqual(path, [1, 2, 3, 4]);
    assert.equal(debtAmountOnPath(ledger, path!), 3);
  });

  it("returns null when there is no path (cross-component)", () => {
    const ledger: DebtEdge[] = [
      { debtorId: 1, creditorId: 30, amount: 5 },
      { debtorId: 2, creditorId: 10, amount: 5 },
    ];
    assert.equal(findDebtPath(ledger, 1, 10), null);
    assert.equal(canPathSettle(ledger, 1, 10), false);
  });
});

describe("Direct badge and settleability", () => {
  it("requires pairwise amount ≥ displayed for Direct", () => {
    const ledger: DebtEdge[] = [
      { debtorId: 1, creditorId: 2, amount: 1 },
      { debtorId: 1, creditorId: 3, amount: 5 },
      { debtorId: 3, creditorId: 2, amount: 5 },
    ];
    const suggested = { debtorId: 1, creditorId: 2, amount: 6 };
    assert.equal(isDirectPairwiseDebt(ledger, suggested), false);
    assert.equal(isSettleableSuggestedEdge(ledger, suggested), true);
    assert.equal(canPathSettle(ledger, 1, 2), true);
  });

  it("marks full pairwise cover as Direct and settleable", () => {
    const ledger: DebtEdge[] = [{ debtorId: 1, creditorId: 2, amount: 3 }];
    const edge = { debtorId: 1, creditorId: 2, amount: 3 };
    assert.equal(isDirectPairwiseDebt(ledger, edge), true);
    assert.equal(isSettleableSuggestedEdge(ledger, edge), true);
  });

  it("marks unrelated components settleable as Direct pairs", () => {
    const ledger: DebtEdge[] = [
      { debtorId: 1, creditorId: 30, amount: 5 },
      { debtorId: 2, creditorId: 10, amount: 5 },
    ];
    const simplified = simplifyDebts(ledger);
    for (const edge of simplified) {
      assert.equal(isDirectPairwiseDebt(ledger, edge), true);
      assert.equal(isSettleableSuggestedEdge(ledger, edge), true);
    }
  });
});
