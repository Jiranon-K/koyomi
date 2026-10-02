"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createTaskAction, type ActionState } from "./actions";

export function TaskForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createTaskAction, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex items-end gap-2">
      <div className="grid flex-1 gap-2">
        <Label htmlFor="title">New task</Label>
        <Input id="title" name="title" maxLength={120} placeholder="What needs doing?" required />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding..." : "Add"}
      </Button>
    </form>
  );
}
