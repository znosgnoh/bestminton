import {
  isLastSingaporeCalendarDayOfMonth,
  singaporeYearMonth,
} from "@/lib/datetime";
import { db } from "@/lib/db";
import { getLedgerSnapshot } from "@/lib/ledgerService";
import { getAppBaseUrl } from "./config";
import { reminderKindsDue, shareIdsFingerprint } from "./reminders";
import {
  allEligibleMembers,
  eligibleMembersByIds,
  unregisteredMembersForMatch,
} from "./recipients";
import { sendToMany } from "./notify";
import { renderChallengeResolvedEmail } from "./templates/challengeResolved";
import { renderDrinkSettledEmail } from "./templates/drinkSettled";
import { renderMonthlyDebtReminderEmail } from "./templates/debtReminder";
import {
  renderLedgerMarkPaidEmail,
  renderLedgerRecordedEmail,
  renderLedgerRemittanceReceivedEmail,
} from "./templates/ledger";
import { renderMatchEmail } from "./templates/match";

export async function notifyMatchCreated(matchId: number): Promise<void> {
  const match = await db.match.findUnique({ where: { id: matchId } });
  if (!match) return;
  const recipients = await unregisteredMembersForMatch(matchId);
  const matchUrl = `${getAppBaseUrl()}/matches/${matchId}`;
  await sendToMany("MATCH_CREATED", `match:${matchId}:created`, recipients, (r) =>
    renderMatchEmail({
      recipientName: r.name,
      title: match.title,
      venue: match.venue,
      scheduledAt: match.scheduledAt,
      matchUrl,
      kind: "created",
    })
  );
}

export async function runMatchReminderCron(
  now = new Date()
): Promise<{ sent96: number; sent48: number }> {
  const matches = await db.match.findMany({
    where: { scheduledAt: { gt: now } },
    select: { id: true, title: true, venue: true, scheduledAt: true },
  });
  let sent96 = 0;
  let sent48 = 0;
  for (const match of matches) {
    const kinds = reminderKindsDue(now, match.scheduledAt);
    for (const kind of kinds) {
      const eventType = kind === "96h" ? "MATCH_REMINDER_96H" : "MATCH_REMINDER_48H";
      const entityKey = `match:${match.id}:reminder-${kind}`;
      const recipients = await unregisteredMembersForMatch(match.id);
      const result = await sendToMany(eventType, entityKey, recipients, (r) =>
        renderMatchEmail({
          recipientName: r.name,
          title: match.title,
          venue: match.venue,
          scheduledAt: match.scheduledAt,
          matchUrl: `${getAppBaseUrl()}/matches/${match.id}`,
          kind: kind === "96h" ? "reminder-96h" : "reminder-48h",
        })
      );
      if (kind === "96h") sent96 += result.sent;
      else sent48 += result.sent;
    }
  }
  return { sent96, sent48 };
}

export async function notifyChallengeResolved(challengeId: number): Promise<void> {
  const challenge = await db.challenge.findUnique({
    where: { id: challengeId },
    include: {
      playerA: { select: { id: true, name: true } },
      playerA2: { select: { id: true, name: true } },
      playerB: { select: { id: true, name: true } },
      playerB2: { select: { id: true, name: true } },
      bets: { select: { bettorId: true } },
    },
  });
  if (!challenge) return;

  const memberIds = [
    challenge.playerAId,
    challenge.playerBId,
    challenge.playerA2Id,
    challenge.playerB2Id,
    ...challenge.bets.map((b) => b.bettorId),
  ].filter((id): id is number => id != null);

  const recipients = await eligibleMembersByIds(memberIds);
  const winnerLabel = challenge.winnerSide === "A" ? "Phe A / Side A" : "Phe B / Side B";
  const snapshot = challenge.resolutionSnapshot as {
    eloChanges?: Array<{ name: string; delta: number }>;
    drinkPayouts?: Array<{ summary: string }>;
  } | null;
  const eloSummary = snapshot?.eloChanges
    ?.map((c) => `${c.name}: ${c.delta > 0 ? "+" : ""}${c.delta} Elo`)
    .join(", ");
  const drinkSummary = snapshot?.drinkPayouts?.map((p) => p.summary).join("; ");

  await sendToMany("CHALLENGE_RESOLVED", `challenge:${challengeId}:resolved`, recipients, (r) =>
    renderChallengeResolvedEmail({
      recipientName: r.name,
      challengeUrl: `${getAppBaseUrl()}/challenges/${challengeId}`,
      winnerLabel,
      score: challenge.confirmedScore ?? "",
      handicap: challenge.confirmedHandicapPoints ?? challenge.handicapPoints,
      eloSummary,
      drinkSummary,
    })
  );
}

export async function notifyDrinkDebtSettled(input: {
  debtorId: number;
  creditorId: number;
  settledAmount: number;
  transactionId: number;
}): Promise<void> {
  const [debtor, creditor] = await Promise.all([
    db.member.findUnique({ where: { id: input.debtorId }, select: { name: true } }),
    db.member.findUnique({ where: { id: input.creditorId }, select: { name: true } }),
  ]);
  if (!debtor || !creditor) return;

  const recipients = await eligibleMembersByIds([input.debtorId, input.creditorId]);
  const entityKey = `drink-settle:${input.transactionId}`;
  await sendToMany("DRINK_DEBT_SETTLED", entityKey, recipients, (r) =>
    renderDrinkSettledEmail({
      recipientName: r.name,
      debtorName: debtor.name,
      creditorName: creditor.name,
      amount: input.settledAmount,
    })
  );
}

export async function notifyLedgerRecorded(expenseId: number): Promise<void> {
  const expense = await db.expense.findUnique({
    where: { id: expenseId },
    include: {
      paidBy: {
        select: { id: true, name: true, email: true, emailNotificationsEnabled: true },
      },
      shares: {
        include: {
          member: {
            select: { id: true, name: true, email: true, emailNotificationsEnabled: true },
          },
        },
      },
    },
  });
  if (!expense || !expense.paidBy) return;

  const balancesUrl = `${getAppBaseUrl()}/balances`;
  for (const share of expense.shares) {
    const member = share.member;
    if (!member.email || !member.emailNotificationsEnabled) continue;
    const recipient = { memberId: member.id, email: member.email, name: member.name };
    await sendToMany(
      "LEDGER_RECORDED",
      `expense:${expenseId}:recorded:${member.id}`,
      [recipient],
      (r) =>
        renderLedgerRecordedEmail({
          recipientName: r.name,
          expenseTitle: expense.title,
          shareAmount: Number(share.owed),
          currency: expense.currency,
          paidByName: expense.paidBy!.name,
          balancesUrl,
        })
    );
  }

  // Court / shuttlecock remittances credit the expense "paidBy" (booker / recipient).
  // They must be emailed too — previously only debtors (share members) were notified.
  if (expense.kind === "COURT" || expense.kind === "SHUTTLECOCK") {
    const creditor = expense.paidBy;
    if (!creditor.email || !creditor.emailNotificationsEnabled) return;
    const totalOwed = expense.shares.reduce((sum, s) => sum + Number(s.owed), 0);
    if (!(totalOwed > 0)) return;
    const fromNames = expense.shares.map((s) => s.member.name).filter(Boolean);
    const fromName = fromNames.length > 0 ? fromNames.join(", ") : "Paid By";
    const kindLabelVi = expense.kind === "COURT" ? "tiền sân" : "tiền cầu";
    const kindLabelEn = expense.kind === "COURT" ? "court" : "shuttlecock";
    await sendToMany(
      "LEDGER_RECORDED",
      `expense:${expenseId}:remittance:${creditor.id}`,
      [{ memberId: creditor.id, email: creditor.email, name: creditor.name }],
      (r) =>
        renderLedgerRemittanceReceivedEmail({
          recipientName: r.name,
          expenseTitle: expense.title,
          amount: totalOwed,
          currency: expense.currency,
          fromName,
          kindLabelVi,
          kindLabelEn,
          balancesUrl,
        })
    );
  }
}

export async function notifyLedgerMarkPaid(input: {
  debtorId: number;
  creditorId: number;
  appliedCents: number;
  appliedShareIds: number[];
  currency: string;
}): Promise<void> {
  const [debtor, creditor] = await Promise.all([
    db.member.findUnique({ where: { id: input.debtorId }, select: { name: true } }),
    db.member.findUnique({ where: { id: input.creditorId }, select: { name: true } }),
  ]);
  if (!debtor || !creditor || input.appliedCents <= 0) return;

  const recipients = await eligibleMembersByIds([input.debtorId, input.creditorId]);
  const entityKey = `ledger-paid:${input.debtorId}:${input.creditorId}:${input.appliedCents}:${shareIdsFingerprint(input.appliedShareIds)}`;
  const amount = input.appliedCents / 100;
  const balancesUrl = `${getAppBaseUrl()}/balances`;

  await sendToMany("LEDGER_MARK_PAID", entityKey, recipients, (r) =>
    renderLedgerMarkPaidEmail({
      recipientName: r.name,
      debtorName: debtor.name,
      creditorName: creditor.name,
      amount,
      currency: input.currency,
      balancesUrl,
    })
  );
}

export async function runMonthlyDebtReminderCron(
  now = new Date()
): Promise<{ sent: number; skipped: number; failed: number; reason?: string }> {
  if (!isLastSingaporeCalendarDayOfMonth(now)) {
    return { sent: 0, skipped: 0, failed: 0, reason: "not_month_end" };
  }

  const snapshot = await getLedgerSnapshot();
  if (snapshot.edges.length === 0) {
    return { sent: 0, skipped: 0, failed: 0, reason: "no_open_debts" };
  }

  const monthKey = singaporeYearMonth(now);
  const recipients = await allEligibleMembers();
  if (recipients.length === 0) {
    return { sent: 0, skipped: 0, failed: 0, reason: "no_recipients" };
  }

  const balancesUrl = `${getAppBaseUrl()}/balances`;
  const entityKey = `debt-clear:${monthKey}`;
  const result = await sendToMany("MONTHLY_DEBT_REMINDER", entityKey, recipients, (r) =>
    renderMonthlyDebtReminderEmail({
      recipientName: r.name,
      recipientMemberId: r.memberId,
      monthLabel: monthKey,
      currency: snapshot.currency,
      edges: snapshot.edges,
      balancesUrl,
    })
  );
  return result;
}
