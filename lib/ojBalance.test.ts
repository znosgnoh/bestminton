import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Prisma } from "@prisma/client";
import {
  summaryFromOjBalance,
  maxSettleAmount,
  rollbackOjSettle,
  settleOjPool,
} from "./ojBalance";

type FakeMember = { id: number; name: string; ojBalance: number };
type FakeSettleRow = {
  id: number;
  fromMemberId: number;
  toMemberId: number;
  amount: number;
  createdAt: Date;
  rolledBackAt: Date | null;
};

/**
 * Minimal in-memory stand-in for a Prisma transaction client, enough to pin the
 * settle / rollback state machine. `interfere` runs once before the first
 * balance write so a competing transaction can be simulated.
 */
function fakeTx(options: {
  members: FakeMember[];
  transactions?: FakeSettleRow[];
  interfere?: () => void;
}) {
  const members = options.members;
  const transactions = options.transactions ?? [];
  let interfere = options.interfere;
  let nextTxId = transactions.reduce((max, row) => Math.max(max, row.id), 0) + 1;

  const runInterference = () => {
    if (!interfere) return;
    const fn = interfere;
    interfere = undefined;
    fn();
  };

  const memberById = (id: number) => members.find((m) => m.id === id);
  const withNames = (row: FakeSettleRow) => ({
    ...row,
    fromMember: { name: memberById(row.fromMemberId)?.name ?? "" },
    toMember: { name: memberById(row.toMemberId)?.name ?? "" },
  });

  const client = {
    member: {
      findUniqueOrThrow: async ({ where }: { where: { id: number } }) => {
        const member = memberById(where.id);
        if (!member) throw new Error(`member ${where.id} not found`);
        return { ...member };
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: number; ojBalance?: { gte?: number; lte?: number } };
        data: { ojBalance: { decrement?: number; increment?: number } };
      }) => {
        runInterference();
        const member = memberById(where.id);
        if (!member) return { count: 0 };
        const { gte, lte } = where.ojBalance ?? {};
        if (gte !== undefined && member.ojBalance < gte) return { count: 0 };
        if (lte !== undefined && member.ojBalance > lte) return { count: 0 };
        member.ojBalance +=
          (data.ojBalance.increment ?? 0) - (data.ojBalance.decrement ?? 0);
        return { count: 1 };
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: number };
        data: { ojBalance: { decrement?: number; increment?: number } };
      }) => {
        runInterference();
        const member = memberById(where.id);
        if (!member) throw new Error(`member ${where.id} not found`);
        member.ojBalance +=
          (data.ojBalance.increment ?? 0) - (data.ojBalance.decrement ?? 0);
        return { ...member };
      },
      aggregate: async () => ({
        _sum: { ojBalance: members.reduce((sum, m) => sum + m.ojBalance, 0) },
      }),
    },
    drinkSettleTransaction: {
      create: async ({
        data,
      }: {
        data: { fromMemberId: number; toMemberId: number; amount: number };
      }) => {
        const row: FakeSettleRow = {
          id: nextTxId++,
          ...data,
          createdAt: new Date(),
          rolledBackAt: null,
        };
        transactions.push(row);
        return withNames(row);
      },
      findUnique: async ({ where }: { where: { id: number } }) => {
        const row = transactions.find((t) => t.id === where.id);
        return row ? withNames(row) : null;
      },
      findUniqueOrThrow: async ({ where }: { where: { id: number } }) => {
        const row = transactions.find((t) => t.id === where.id);
        if (!row) throw new Error(`transaction ${where.id} not found`);
        return withNames(row);
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: number; rolledBackAt: Date | null };
        data: { rolledBackAt: Date };
      }) => {
        const row = transactions.find((t) => t.id === where.id);
        if (!row) return { count: 0 };
        if (where.rolledBackAt === null && row.rolledBackAt !== null) {
          return { count: 0 };
        }
        row.rolledBackAt = data.rolledBackAt;
        return { count: 1 };
      },
    },
  };

  return {
    tx: client as unknown as Prisma.TransactionClient,
    members,
    transactions,
  };
}

function errorCode(err: unknown): string | undefined {
  return err && typeof err === "object" && "code" in err
    ? String((err as { code: unknown }).code)
    : undefined;
}

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

describe("settleOjPool", () => {
  it("moves the requested amount and logs the settle", async () => {
    const fake = fakeTx({
      members: [
        { id: 1, name: "Owner", ojBalance: 3 },
        { id: 2, name: "Ower", ojBalance: -3 },
      ],
    });

    const result = await settleOjPool(
      { fromMemberId: 1, toMemberId: 2, amount: 2 },
      fake.tx
    );

    assert.equal(result.settled, 2);
    assert.equal(fake.members[0].ojBalance, 1);
    assert.equal(fake.members[1].ojBalance, -1);
    assert.equal(fake.transactions.length, 1);
    assert.equal(fake.transactions[0].amount, 2);
  });

  it("settles the max when no amount is given", async () => {
    const fake = fakeTx({
      members: [
        { id: 1, name: "Owner", ojBalance: 2 },
        { id: 2, name: "Ower", ojBalance: -2 },
      ],
    });

    const result = await settleOjPool({ fromMemberId: 1, toMemberId: 2 }, fake.tx);

    assert.equal(result.settled, 2);
    assert.equal(fake.members[0].ojBalance, 0);
    assert.equal(fake.members[1].ojBalance, 0);
  });

  it("rejects an amount above the max with INSUFFICIENT", async () => {
    const fake = fakeTx({
      members: [
        { id: 1, name: "Owner", ojBalance: 2 },
        { id: 2, name: "Ower", ojBalance: -2 },
      ],
    });

    await assert.rejects(
      settleOjPool({ fromMemberId: 1, toMemberId: 2, amount: 3 }, fake.tx),
      (err: unknown) => errorCode(err) === "INSUFFICIENT"
    );
    assert.equal(fake.members[0].ojBalance, 2);
    assert.equal(fake.transactions.length, 0);
  });

  it("rejects when there is nothing to settle", async () => {
    const fake = fakeTx({
      members: [
        { id: 1, name: "A", ojBalance: 2 },
        { id: 2, name: "B", ojBalance: 1 },
      ],
    });

    await assert.rejects(
      settleOjPool({ fromMemberId: 1, toMemberId: 2 }, fake.tx),
      (err: unknown) => errorCode(err) === "NO_BALANCE"
    );
  });

  it("fails with INSUFFICIENT when a concurrent settle drained the balance", async () => {
    const members: FakeMember[] = [
      { id: 1, name: "Owner", ojBalance: 3 },
      { id: 2, name: "Ower", ojBalance: -3 },
      { id: 3, name: "Other", ojBalance: 0 },
    ];
    const fake = fakeTx({
      members,
      // Competing settle commits between our read and our write.
      interfere: () => {
        members[0].ojBalance -= 3;
        members[2].ojBalance += 3;
      },
    });

    await assert.rejects(
      settleOjPool({ fromMemberId: 1, toMemberId: 2, amount: 3 }, fake.tx),
      (err: unknown) => errorCode(err) === "INSUFFICIENT"
    );
    // The debit guard refused, so the owner is not pushed negative.
    assert.equal(members[0].ojBalance, 0);
    assert.equal(members[1].ojBalance, -3);
    assert.equal(fake.transactions.length, 0);
  });

  it("fails with INSUFFICIENT when the receiver no longer owes that much", async () => {
    const members: FakeMember[] = [
      { id: 1, name: "Owner", ojBalance: 3 },
      { id: 2, name: "Ower", ojBalance: -3 },
      { id: 3, name: "Other", ojBalance: 0 },
    ];
    const fake = fakeTx({
      members,
      // Someone else pays down the ower's debt between our read and our write.
      interfere: () => {
        members[1].ojBalance += 2;
        members[2].ojBalance -= 2;
      },
    });

    await assert.rejects(
      settleOjPool({ fromMemberId: 1, toMemberId: 2, amount: 3 }, fake.tx),
      (err: unknown) => errorCode(err) === "INSUFFICIENT"
    );
    assert.equal(fake.transactions.length, 0);
  });
});

describe("rollbackOjSettle", () => {
  it("reverses the balances and stamps rolledBackAt once", async () => {
    const fake = fakeTx({
      members: [
        { id: 1, name: "Owner", ojBalance: 1 },
        { id: 2, name: "Ower", ojBalance: -1 },
      ],
      transactions: [
        {
          id: 7,
          fromMemberId: 1,
          toMemberId: 2,
          amount: 2,
          createdAt: new Date("2026-09-01T00:00:00Z"),
          rolledBackAt: null,
        },
      ],
    });

    const dto = await rollbackOjSettle(7, fake.tx);

    assert.equal(dto.id, 7);
    assert.notEqual(dto.rolledBackAt, null);
    assert.equal(fake.members[0].ojBalance, 3);
    assert.equal(fake.members[1].ojBalance, -3);
  });

  it("refuses a second rollback without touching balances again", async () => {
    const fake = fakeTx({
      members: [
        { id: 1, name: "Owner", ojBalance: 1 },
        { id: 2, name: "Ower", ojBalance: -1 },
      ],
      transactions: [
        {
          id: 7,
          fromMemberId: 1,
          toMemberId: 2,
          amount: 2,
          createdAt: new Date("2026-09-01T00:00:00Z"),
          rolledBackAt: null,
        },
      ],
    });

    await rollbackOjSettle(7, fake.tx);
    await assert.rejects(
      rollbackOjSettle(7, fake.tx),
      (err: unknown) => errorCode(err) === "ALREADY_ROLLED_BACK"
    );
    assert.equal(fake.members[0].ojBalance, 3);
    assert.equal(fake.members[1].ojBalance, -3);
  });

  it("reports NOT_FOUND for an unknown transaction", async () => {
    const fake = fakeTx({ members: [{ id: 1, name: "A", ojBalance: 0 }] });

    await assert.rejects(
      rollbackOjSettle(404, fake.tx),
      (err: unknown) => errorCode(err) === "NOT_FOUND"
    );
  });
});
