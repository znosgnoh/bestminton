import { notFound } from "next/navigation";
import PayNowPageClient from "@/components/paynow/PayNowPageClient";
import { db } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/dbConfig";
import { formatDatabaseError, logDatabaseError, withDbRetry } from "@/lib/dbHealth";
import { ensurePaynowMobileColumn } from "@/lib/ensurePaynowMobile";

export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

interface PageProps {
  params: Promise<{ memberId: string }>;
  searchParams: Promise<{ amount?: string; ref?: string; from?: string }>;
}

export default async function PayNowPage({ params, searchParams }: PageProps) {
  const { memberId: idStr } = await params;
  const query = await searchParams;
  const memberId = parseInt(idStr, 10);
  if (!Number.isInteger(memberId) || memberId <= 0) notFound();

  if (!isDatabaseConfigured()) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 text-sm text-gray-600 dark:text-gray-400">
        PayNow requires a live database connection.
      </div>
    );
  }

  let member: { id: number; name: string; paynowMobile: string | null } | null = null;
  try {
    await ensurePaynowMobileColumn();
    member = await withDbRetry(() =>
      db.member.findUnique({
        where: { id: memberId },
        select: { id: true, name: true, paynowMobile: true },
      })
    );
  } catch (err) {
    logDatabaseError("PayNowPage", err);
    return (
      <div className="mx-auto max-w-lg px-4 py-8 text-sm text-gray-600 dark:text-gray-400">
        {formatDatabaseError(err)}
      </div>
    );
  }

  if (!member) notFound();

  const amountRaw = query.amount ? Number(query.amount) : NaN;
  const amount =
    Number.isFinite(amountRaw) && amountRaw > 0 ? Math.round(amountRaw * 100) / 100 : null;

  return (
    <PayNowPageClient
      memberName={member.name}
      paynowMobile={member.paynowMobile}
      amount={amount}
      reference={typeof query.ref === "string" ? query.ref : null}
      fromName={typeof query.from === "string" ? query.from : null}
    />
  );
}
