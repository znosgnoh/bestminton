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
