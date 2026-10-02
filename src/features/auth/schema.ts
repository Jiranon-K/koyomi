import * as z from "zod";

const email = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : value),
  z.email("Enter a valid email address."),
);

export const signUpSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(100, "Use at most 100 characters."),
  email,
  // Same bounds as the Better Auth defaults, so the form and the server agree.
  password: z.string().min(8, "Use at least 8 characters.").max(128, "Use at most 128 characters."),
});

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password."),
});

export const emailSchema = z.object({ email });

export type FieldErrors = Partial<Record<string, string>>;

/** First message per field, ready to show next to its input. */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "");
    errors[field] ??= issue.message;
  }
  return errors;
}
