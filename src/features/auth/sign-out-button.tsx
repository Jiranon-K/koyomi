"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { authClient, networkError } from "./client";
import { SIGN_IN_PATH } from "./paths";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    if (pending) return;
    setPending(true);
    const { error } = await authClient.signOut().catch(networkError);
    if (error) {
      setPending(false);
      toast.error("Could not sign out. Please try again.");
      return;
    }
    router.push(SIGN_IN_PATH);
    router.refresh();
  }

  return (
    <Button variant="outline" onClick={signOut} disabled={pending} aria-busy={pending}>
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
