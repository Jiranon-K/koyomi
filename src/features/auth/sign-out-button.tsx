"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { signOut } from "./client";
import { SIGN_IN_PATH } from "./paths";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
    if (pending) return;
    setPending(true);
    const outcome = await signOut();
    if (outcome.kind === "error") {
      setPending(false);
      toast.error(outcome.message);
      return;
    }
    router.push(SIGN_IN_PATH);
    router.refresh();
  }

  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={pending} aria-busy={pending}>
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
