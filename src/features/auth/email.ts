export type EmailMessage = {
  to: string;
  kind: "verify-email" | "reset-password";
  subject: string;
  url: string;
};

export type SendEmail = (message: EmailMessage) => Promise<void>;

export const sendEmail: SendEmail = async (message) => {
  console.log(`[email] to=${message.to} subject="${message.subject}"\n[email] ${message.url}`);
};
