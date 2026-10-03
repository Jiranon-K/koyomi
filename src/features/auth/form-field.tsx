import { cn } from "cn";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type FormFieldProps = Omit<React.ComponentProps<typeof Input>, "id" | "name"> & {
  name: string;
  label: string;
  error?: string;
  hint?: string;
  trailing?: React.ReactNode;
};

export function FormField({
  name,
  label,
  error,
  hint,
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
          className={cn(trailing && "pr-11", className)}
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

export function FormError({ message }: { message: React.ReactNode }) {
  return (
    <p role="alert" className="text-sm text-destructive empty:sr-only">
      {message}
    </p>
  );
}

export function FormNotice({ message }: { message: React.ReactNode }) {
  return (
    <p role="status" className="text-sm text-muted-foreground empty:sr-only">
      {message}
    </p>
  );
}
