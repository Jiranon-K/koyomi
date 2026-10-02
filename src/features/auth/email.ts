export type EmailMessage = {
  to: string;
  kind: "verify-email" | "reset-password";
  subject: string;
  url: string;
};

export type SendEmail = (message: EmailMessage) => Promise<void>;

// Development stand-in: prints the email so verify/reset links can be followed without a provider.
// Replace this one function with a real provider (e.g. Resend) when needed.
export const sendEmail: SendEmail = async (message) => {
  console.log(`[email] to=${message.to} subject="${message.subject}"\n[email] ${message.url}`);
};
