export type ReminderKind = "96h" | "48h";

export interface EmailRecipient {
  memberId: number;
  email: string;
  name: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}
