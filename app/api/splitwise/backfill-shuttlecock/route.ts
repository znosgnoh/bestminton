import { NextRequest, NextResponse } from "next/server";
import { pinFromRequest, requireAdminPin } from "@/lib/apiHelpers";
import { db } from "@/lib/db";
import { revalidateMatchPages } from "@/lib/revalidate";
import {
  DEFAULT_SHUTTLECOCK_RECIPIENT_NAME,
  formatShuttlecockRemittanceDescription,
  getShuttlecockFeePerHour,
  isSingleMatchTitle,
  shouldCreateShuttlecockRemittance,
  splitSettlementFees,
} from "@/lib/shuttlecock";
import {
  buildShuttlecockRemittancePayload,
  fetchGroupMembers,
  findParticipantsMissingFromGroup,
  formatShareAmount,
  getGroupId,
  isSplitwiseConfigured,
  postSplitwiseExpense,
} from "@/lib/splitwise";

export const dynamic = "force-dynamic";

/**
 * Backfill Splitwise shuttlecock remittances for past settled matches
 * (except single-title matches). Safe to re-run: skips shuttlecockRemitted.
 */
export async function POST(request: NextRequest) {
  let body: { pin?: string; dryRun?: boolean } = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text) as { pin?: string; dryRun?: boolean };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const pinDenied = requireAdminPin(pinFromRequest(request, body));
  if (pinDenied) return pinDenied;

  if (!isSplitwiseConfigured()) {
    return NextResponse.json(
      {
        error:
          "Splitwise is not configured. Add SPLITWISE_API_KEY and SPLITWISE_GROUP_ID to your environment.",
      },
      { status: 503 }
    );
  }

  const dryRun = Boolean(body.dryRun);
  const now = new Date();
  const rate = getShuttlecockFeePerHour();

  let groupId: string;
  try {
    groupId = getGroupId();
  } catch {
    return NextResponse.json(
      { error: "Server configuration error: SPLITWISE_GROUP_ID is not set." },
      { status: 500 }
    );
  }

  const groupLookup = await fetchGroupMembers(groupId);
  if ("error" in groupLookup) {
    return NextResponse.json({ error: groupLookup.error }, { status: 502 });
  }

  const tienHoang = await db.member.findFirst({
    where: { name: { equals: DEFAULT_SHUTTLECOCK_RECIPIENT_NAME, mode: "insensitive" } },
    select: { id: true, name: true, splitwiseId: true },
  });

  if (!tienHoang?.splitwiseId) {
    return NextResponse.json(
      {
        error: `Default shuttlecock recipient "${DEFAULT_SHUTTLECOCK_RECIPIENT_NAME}" not found or missing Splitwise ID.`,
      },
      { status: 422 }
    );
  }

  const matches = await db.match.findMany({
    where: {
      scheduledAt: { lt: now },
      shuttlecockRemitted: false,
      totalCost: { not: null, gt: 0 },
      hours: { not: null, gt: 0 },
      paidByMemberId: { not: null },
    },
    include: {
      paidBy: { select: { id: true, name: true, splitwiseId: true } },
      shuttlecockRecipient: { select: { id: true, name: true, splitwiseId: true } },
    },
    orderBy: { scheduledAt: "asc" },
  });

  const created: Array<{
    matchId: number;
    title: string;
    fee: number;
    paidBy: string;
    recipient: string;
    expenseId?: number;
    description: string;
  }> = [];
  const skipped: Array<{ matchId: number; title: string; reason: string }> = [];
  const failed: Array<{ matchId: number; title: string; error: string }> = [];

  for (const match of matches) {
    if (isSingleMatchTitle(match.title)) {
      skipped.push({ matchId: match.id, title: match.title, reason: "Single-title match" });
      continue;
    }

    const recipient = match.shuttlecockRecipient ?? tienHoang;
    const recipientId = match.shuttlecockRecipientMemberId ?? tienHoang.id;

    // Persist default recipient if missing (so history shows Tiến Hoàng)
    if (!match.shuttlecockRecipientMemberId && !dryRun) {
      await db.match.update({
        where: { id: match.id },
        data: { shuttlecockRecipientMemberId: tienHoang.id },
      });
    }

    const split = splitSettlementFees(match.totalCost!, match.hours!, rate);
    if (
      !shouldCreateShuttlecockRemittance({
        title: match.title,
        shuttlecockFee: split.shuttlecockFee,
        paidByMemberId: match.paidByMemberId,
        shuttlecockRecipientMemberId: recipientId,
      })
    ) {
      skipped.push({
        matchId: match.id,
        title: match.title,
        reason:
          match.paidByMemberId === recipientId
            ? "Paid By is shuttlecock recipient"
            : "No shuttlecock fee",
      });
      continue;
    }

    const paidBy = match.paidBy;
    if (!paidBy?.splitwiseId) {
      skipped.push({
        matchId: match.id,
        title: match.title,
        reason: `Paid By (${paidBy?.name ?? "?"}) missing Splitwise ID`,
      });
      continue;
    }

    const recipientSwId = recipient.splitwiseId ?? tienHoang.splitwiseId;
    if (!recipientSwId) {
      skipped.push({
        matchId: match.id,
        title: match.title,
        reason: `Recipient (${recipient.name}) missing Splitwise ID`,
      });
      continue;
    }

    const missing = findParticipantsMissingFromGroup(
      [{ userId: paidBy.splitwiseId }, { userId: recipientSwId }],
      groupLookup.members
    );
    if (missing.length > 0) {
      skipped.push({
        matchId: match.id,
        title: match.title,
        reason: "Paid By or recipient not in Splitwise group",
      });
      continue;
    }

    const description = formatShuttlecockRemittanceDescription(match.title, match.scheduledAt);
    const entry = {
      matchId: match.id,
      title: match.title,
      fee: split.shuttlecockFee,
      paidBy: paidBy.name,
      recipient: recipient.name,
      description,
    };

    if (dryRun) {
      created.push(entry);
      continue;
    }

    const result = await postSplitwiseExpense(
      buildShuttlecockRemittancePayload({
        groupId: Number(groupId),
        fee: split.shuttlecockFee,
        description,
        date: match.scheduledAt.toISOString(),
        details: `${paidBy.name} remits ${formatShareAmount(split.shuttlecockFee)} shuttlecock to ${recipient.name}`,
        paidBySplitwiseId: paidBy.splitwiseId,
        recipientSplitwiseId: recipientSwId,
      })
    );

    if (result.error || !result.expenseId) {
      failed.push({
        matchId: match.id,
        title: match.title,
        error: result.error ?? "No expense ID returned",
      });
      continue;
    }

    await db.match.update({
      where: { id: match.id },
      data: {
        shuttlecockRemitted: true,
        shuttlecockRecipientMemberId: recipientId,
      },
    });
    revalidateMatchPages(match.id);

    created.push({ ...entry, expenseId: result.expenseId });
  }

  return NextResponse.json({
    success: failed.length === 0,
    dryRun,
    ratePerHour: rate,
    summary: {
      created: created.length,
      skipped: skipped.length,
      failed: failed.length,
    },
    created,
    skipped,
    failed,
  });
}
