"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

import { followAction, unfollowAction } from "./actions";

type FollowButtonProps = { showRoute: string; title: string; followed: boolean };

function Submit({ title, followed }: Omit<FollowButtonProps, "showRoute">) {
  const { pending } = useFormStatus();
  const label = followed ? "Unfollow" : "Follow";

  return (
    <Button
      type="submit"
      variant={followed ? "ghost" : "outline"}
      size="sm"
      disabled={pending}
      aria-busy={pending}
      aria-label={`${label} ${title}`}
    >
      {label}
    </Button>
  );
}

/** Follows or unfollows one show for the signed-in user. Works as a plain form without JavaScript. */
export function FollowButton({ showRoute, title, followed }: FollowButtonProps) {
  return (
    <form action={followed ? unfollowAction : followAction}>
      <input type="hidden" name="showRoute" value={showRoute} />
      <Submit title={title} followed={followed} />
    </form>
  );
}
