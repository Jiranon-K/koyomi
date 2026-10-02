import { cn } from "cn";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { FieldErrors } from "./schema";

/** Taller buttons for the sign-in and sign-up pages; fields take `large` instead. */
export const LARGE_CONTROL = "h-11 rounded-xl";

export type FormFieldProps = Omit<React.ComponentProps<typeof Input>, "id" | "name"> & {
  name: string;
  label: string;
  error?: string;
  hint?: string;
  /** Taller, roomier input, as used on the sign-in and sign-up pages. */
  large?: boolean;
  /** A control drawn inside the input's right edge, such as a show-password button. */
  trailing?: React.ReactNode;
};

export function FormField({
  name,
  label,
  error,
  hint,
  large,
  trailing,
  className,
  ...props
}: FormFieldProps) {
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ");

  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <div className="relative">
        <Input
          id={name}
          name={name}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={cn(
            large ? `${LARGE_CONTROL} pl-4` : null,
            // Room for the trailing control, so typed text never runs under it.
            trailing ? "pr-11" : large ? "pr-4" : null,
            className,
          )}
          {...props}
        />
        {trailing ? (
          <div className="absolute top-1/2 right-2 -translate-y-1/2">{trailing}</div>
        ) : null}
      </div>
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Moves focus to the first field with an error, so keyboard and screen reader users land on it. */
export function focusFirstInvalid(form: HTMLFormElement, errors: FieldErrors): void {
  const first = Array.from(form.elements).find(
    (element) => element instanceof HTMLInputElement && errors[element.name],
  );
  if (first instanceof HTMLInputElement) first.focus();
}

export function FormError({ message }: { message: React.ReactNode }) {
  // The live region stays mounted (visually hidden while empty) so a later message is announced.
  return (
    <p role="alert" className="text-sm text-destructive empty:sr-only">
      {message}
    </p>
  );
}
