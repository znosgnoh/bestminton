import { db } from "@/lib/db";
import { EmailEventType } from "@prisma/client";
import { sendEmail } from "./client";
import { isEmailConfigured } from "./config";
import type { EmailRecipient, RenderedEmail } from "./types";

export async function hasBeenSent(
  memberId: number,
  eventType: EmailEventType,
  entityKey: string
): Promise<boolean> {
  const row = await db.emailDelivery.findUnique({
    where: { memberId_eventType_entityKey: { memberId, eventType, entityKey } },
  });
  return Boolean(row);
}

export async function sendToMember(input: {
  eventType: EmailEventType;
  entityKey: string;
  recipient: EmailRecipient;
  email: RenderedEmail;
}): Promise<"sent" | "skipped" | "failed"> {
  if (!isEmailConfigured()) return "skipped";
  if (await hasBeenSent(input.recipient.memberId, input.eventType, input.entityKey)) {
    return "skipped";
  }
  const result = await sendEmail({
    to: input.recipient.email,
    subject: input.email.subject,
    html: input.email.html,
    text: input.email.text,
  });
  if (!result.ok) {
    console.error("[email] send failed", input.eventType, input.entityKey, result.error);
    return "failed";
  }
  await db.emailDelivery.create({
    data: {
      memberId: input.recipient.memberId,
      eventType: input.eventType,
      entityKey: input.entityKey,
      resendId: result.id,
    },
  });
  return "sent";
}

export async function sendToMany(
  eventType: EmailEventType,
  entityKey: string,
  recipients: EmailRecipient[],
  render: (recipient: EmailRecipient) => RenderedEmail
): Promise<{ sent: number; skipped: number; failed: number }> {
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const recipient of recipients) {
    const outcome = await sendToMember({
      eventType,
      entityKey,
      recipient,
      email: render(recipient),
    });
    if (outcome === "sent") sent += 1;
    else if (outcome === "skipped") skipped += 1;
    else failed += 1;
  }
  return { sent, skipped, failed };
}
