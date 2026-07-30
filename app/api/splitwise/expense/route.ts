import { NextRequest, NextResponse } from "next/server";
import {
  isSplitwiseConfigured,
  getGroupId,
  buildCreateExpensePayload,
  buildShuttlecockRemittancePayload,
  postSplitwiseExpense,
  validateExpenseShares,
  fetchGroupMembers,
  findParticipantsMissingFromGroup,
  formatShareAmount,
} from "@/lib/splitwise";
import { pinFromRequest, requireAdminPin } from "@/lib/apiHelpers";
import type { CreateExpenseRequest } from "@/lib/types";
import { db } from "@/lib/db";
import { revalidateMatchPages } from "@/lib/revalidate";
import {
  formatShuttlecockRemittanceDescription,
  getShuttlecockFeePerHour,
  shouldCreateShuttlecockRemittance,
  splitSettlementFees,
} from "@/lib/shuttlecock";

export async function POST(request: NextRequest) {
  if (!isSplitwiseConfigured()) {
    return NextResponse.json(
      {
        error:
          "Splitwise is not configured. Add SPLITWISE_API_KEY and SPLITWISE_GROUP_ID to your environment.",
      },
      { status: 503 }
    );
  }

  let body: CreateExpenseRequest;
  try {
    body = (await request.json()) as CreateExpenseRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const pinDenied = requireAdminPin(pinFromRequest(request, body));
  if (pinDenied) return pinDenied;

  const { totalCost, paidById, participants, matchId } = body;
  if (!totalCost || totalCost <= 0 || !paidById || !participants?.length) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const shareError = validateExpenseShares(totalCost, paidById, participants);
  if (shareError) {
    return NextResponse.json({ error: shareError }, { status: 422 });
  }

  const match = matchId
    ? await db.match.findUnique({
        where: { id: matchId },
        include: {
          paidBy: { select: { id: true, name: true, splitwiseId: true } },
          shuttlecockRecipient: { select: { id: true, name: true, splitwiseId: true } },
        },
      })
    : null;

  if (matchId) {
    if (!match) {
      return NextResponse.json({ error: "Match not found." }, { status: 404 });
    }
    if (match.synced) {
      return NextResponse.json(
        { error: "This match has already been synced to Splitwise." },
        { status: 409 }
      );
    }
  }

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

  const missingIds = findParticipantsMissingFromGroup(participants, groupLookup.members);
  if (missingIds.length > 0) {
    const localMembers = await db.member.findMany({
      where: { splitwiseId: { in: missingIds } },
      select: { name: true, splitwiseId: true },
    });
    const nameBySwId = new Map(
      localMembers.map((m) => [m.splitwiseId!, m.name] as const)
    );
    const labels = missingIds.map(
      (id) => `${nameBySwId.get(id) ?? `Splitwise user ${id}`} (SW ${id})`
    );
    const groupLabel = groupLookup.groupName
      ? `"${groupLookup.groupName}"`
      : `group ${groupId}`;
    return NextResponse.json(
      {
        error:
          `These players are not in Splitwise ${groupLabel}: ${labels.join(", ")}. ` +
          "Add them to that group (or fix their Splitwise ID in Management), then sync again.",
        missingSplitwiseIds: missingIds,
      },
      { status: 422 }
    );
  }

  const hoursForFee = match?.hours ?? null;
  const totalForFee = match?.totalCost ?? totalCost;
  const split =
    match && hoursForFee != null && hoursForFee > 0 && totalForFee > 0
      ? splitSettlementFees(totalForFee, hoursForFee, getShuttlecockFeePerHour())
      : null;

  const remittance =
    match &&
    !match.shuttlecockRemitted &&
    split &&
    shouldCreateShuttlecockRemittance({
      title: match.title,
      shuttlecockFee: split.shuttlecockFee,
      paidByMemberId: match.paidByMemberId,
      shuttlecockRecipientMemberId: match.shuttlecockRecipientMemberId,
    })
      ? {
          fee: split.shuttlecockFee,
          paidBy: match.paidBy,
          recipient: match.shuttlecockRecipient,
        }
      : null;

  if (remittance) {
    if (!remittance.paidBy?.splitwiseId || !remittance.recipient?.splitwiseId) {
      return NextResponse.json(
        {
          error:
            "Shuttlecock remittance requires Splitwise IDs for both Paid By and Shuttlecock recipient. " +
            "Update them in Management, then sync again.",
        },
        { status: 422 }
      );
    }

    const remitMissing = findParticipantsMissingFromGroup(
      [
        { userId: remittance.paidBy.splitwiseId },
        { userId: remittance.recipient.splitwiseId },
      ],
      groupLookup.members
    );
    if (remitMissing.length > 0) {
      return NextResponse.json(
        {
          error:
            "Paid By or Shuttlecock recipient is not in the Splitwise group. " +
            "Add them to the group, then sync again.",
          missingSplitwiseIds: remitMissing,
        },
        { status: 422 }
      );
    }
  }

  const mainResult = await postSplitwiseExpense(
    buildCreateExpensePayload({ ...body, groupId: Number(groupId) })
  );
  if (mainResult.error || !mainResult.expenseId) {
    return NextResponse.json(
      { error: mainResult.error ?? "Failed to create Splitwise expense." },
      { status: mainResult.status ?? 502 }
    );
  }

  let shuttlecockExpenseId: number | undefined;
  if (remittance && remittance.paidBy?.splitwiseId && remittance.recipient?.splitwiseId) {
    const fee = remittance.fee;
    const remitResult = await postSplitwiseExpense(
      buildShuttlecockRemittancePayload({
        groupId: Number(groupId),
        fee,
        description: formatShuttlecockRemittanceDescription(match!.title, match!.scheduledAt),
        date: body.date ?? match!.scheduledAt.toISOString(),
        details:
          `${remittance.paidBy.name} remits ${formatShareAmount(fee)} shuttlecock to ${remittance.recipient.name}` +
          (match!.venue ? `\nVenue: ${match!.venue}` : ""),
        paidBySplitwiseId: remittance.paidBy.splitwiseId,
        recipientSplitwiseId: remittance.recipient.splitwiseId,
      })
    );
    if (remitResult.error || !remitResult.expenseId) {
      return NextResponse.json(
        {
          error:
            `Court expense was created (ID ${mainResult.expenseId}), but shuttlecock remittance failed: ` +
            (remitResult.error ?? "unknown error") +
            ". Fix the issue and contact an admin — match was not marked synced.",
          expenseId: mainResult.expenseId,
        },
        { status: remitResult.status ?? 502 }
      );
    }
    shuttlecockExpenseId = remitResult.expenseId;
  }

  if (matchId) {
    try {
      await db.match.update({
        where: { id: matchId },
        data: {
          synced: true,
          ...(shuttlecockExpenseId ? { shuttlecockRemitted: true } : {}),
        },
      });
      revalidateMatchPages(matchId);
    } catch {
      console.error(`Failed to mark match ${matchId} as synced`);
    }
  }

  return NextResponse.json({
    success: true,
    expenseId: mainResult.expenseId,
    shuttlecockExpenseId: shuttlecockExpenseId ?? null,
  });
}
