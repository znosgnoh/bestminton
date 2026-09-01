import { Resend } from "resend";
import { getEmailFrom, isEmailConfigured } from "./config";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

let resendClient: Resend | null = null;

function getClient(): Resend {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!isEmailConfigured()) return { ok: false, error: "email_not_configured" };
  try {
    const { data, error } = await getClient().emails.send({
      from: getEmailFrom(),
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    if (error) return { ok: false, error: error.message };
    if (!data?.id) return { ok: false, error: "missing_resend_id" };
    return { ok: true, id: data.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "send_failed";
    return { ok: false, error: message };
  }
}
