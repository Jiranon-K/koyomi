import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { FieldErrors } from "./schema";

type FormFieldProps = Omit<React.ComponentProps<typeof Input>, "id" | "name"> & {
  name: string;
  label: string;
  error?: string;
  hint?: string;
};

export function FormField({ name, label, error, hint, ...props }: FormFieldProps) {
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ");

  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...props}
      />
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

export function FormError({ message }: { message: string | null }) {
  // The live region stays mounted (visually hidden while empty) so a later message is announced.
  return (
    <p role="alert" className="text-sm text-destructive empty:sr-only">
      {message}
    </p>
  );
}
