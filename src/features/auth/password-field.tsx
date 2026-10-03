"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

import { FormField, type FormFieldProps } from "./form-field";

export function PasswordField(props: Omit<FormFieldProps, "type" | "trailing">) {
  const [visible, setVisible] = useState(false);

  return (
    <FormField
      {...props}
      type={visible ? "text" : "password"}
      trailing={
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          aria-label="Show password"
          aria-pressed={visible}
          className="flex size-8 items-center justify-center text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      }
    />
  );
}
