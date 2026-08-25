"use client";

import { LogOut } from "lucide-react";
import { useTransition } from "react";
import { MenuItem } from "@/components/ui";
import { signOutAction } from "@/features/auth/server/actions";

/**
 * Sign out, from the account menu.
 *
 * `onSelect` is prevented from closing the menu until the transition starts, so
 * the item can show that something is happening. Without it the menu vanishes
 * instantly and a slow network looks like a dead click.
 */
export function SignOutItem() {
  const [isPending, startTransition] = useTransition();

  return (
    <MenuItem
      destructive
      disabled={isPending}
      onSelect={(event) => {
        event.preventDefault();
        startTransition(async () => {
          await signOutAction();
        });
      }}
    >
      <LogOut aria-hidden />
      {isPending ? "Signing out…" : "Sign out"}
    </MenuItem>
  );
}
