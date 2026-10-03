"use client";

import { useState } from "react";
import type * as z from "zod";

import { fieldErrors, type FieldErrors } from "./schema";

function focusFirstInvalid(form: HTMLFormElement, errors: FieldErrors): void {
  const first = Array.from(form.elements).find(
    (element) => element instanceof HTMLInputElement && errors[element.name],
  );
  if (first instanceof HTMLInputElement) first.focus();
}

export function useAuthForm<Schema extends z.ZodType>(
  schema: Schema,
  submit: (data: z.output<Schema>) => Promise<React.ReactNode | void>,
) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<React.ReactNode>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const parsed = schema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    setMessage(null);
    if (!parsed.success) {
      const invalid = fieldErrors(parsed.error);
      setErrors(invalid);
      focusFirstInvalid(event.currentTarget, invalid);
      return;
    }
    setErrors({});
    setPending(true);

    const result = await submit(parsed.data);
    if (result === undefined) return;
    setPending(false);
    setMessage(result);
  }

  return { errors, message, pending, onSubmit };
}
