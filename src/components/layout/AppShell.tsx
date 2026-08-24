"use client";

import { Bell, CircleHelp, Menu as MenuIcon, X } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { SideNav } from "./SideNav";
import { ThemeToggle } from "./ThemeToggle";
import { Logo } from "@/components/shared/Logo";
import {
  IconButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  UserPill,
} from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * The authenticated shell: one floating canvas holding an icon rail, a top bar
 * and the content column — brand direction "Daylight" (docs/branding.md).
 *
 * Two scroll models on purpose:
 *
 *  - From 768px the canvas is pinned to the viewport and `<main>` scrolls
 *    inside it, so the rail and top bar never leave. That is what makes it read
 *    as an application rather than a document.
 *  - Below 768px the canvas goes full-bleed and the PAGE scrolls. A nested
 *    scroll container on a phone fights the browser's own address-bar collapse
 *    and the on-screen keyboard, and steals the pull-to-refresh gesture.
 *
 * Responsive behaviour is one component in two containers, not two builds —
 * 72px rail from 768px, drawer below that (docs/navigation.md §5).
 *
 * Client Component because the drawer holds open/closed state. Pages rendered
 * into `children` stay Server Components: the shell is the only client boundary.
 */

export type AppShellProps = {
  children: ReactNode;
  /**
   * Page-owned control rendered in the centre of the top bar — the dashboard's
   * range switcher, a subject's section tabs. The shell deliberately does not
   * invent one: a global control that means something different on every page
   * is worse than an empty space.
   */
  toolbar?: ReactNode;
  user: { name: string; email: string };
  quota?: { used: number; limit: number; resetsAt: string };
};

export function AppShell({ children, toolbar, user, quota }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-dvh p-0 sm:p-4 md:h-dvh lg:p-6">
      <div
        className={cn(
          "flex min-h-dvh overflow-hidden border-rule bg-paper sm:min-h-0",
          "sm:rounded-[var(--radius-canvas)] sm:border sm:shadow-[var(--shadow-canvas)]",
          "md:h-full",
        )}
      >
        {/* Icon rail — 768px and up */}
        <div className="hidden shrink-0 md:block">
          <SideNav />
        </div>

        {/* Drawer — below 768px */}
        {drawerOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <button
              aria-label="Close navigation"
              className="absolute inset-0 bg-[color-mix(in_oklab,var(--ink)_50%,transparent)]"
              onClick={() => setDrawerOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 shadow-[var(--shadow-pop)]">
              <SideNav drawer quota={quota} onNavigate={() => setDrawerOpen(false)} />
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 shrink-0 items-center gap-3 px-4 sm:px-6 md:h-[4.5rem]">
            <button
              aria-label="Open navigation"
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen(true)}
              className="-ml-1 flex size-10 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink md:hidden"
            >
              {drawerOpen ? <X className="size-5" /> : <MenuIcon className="size-5" />}
            </button>

            <Link href="/dashboard" className="shrink-0 max-md:hidden">
              <Logo />
            </Link>

            {/* Page-owned control, centred the way the reference centres its
                range switcher. Hidden below `lg` — at that width the page
                header renders the same control inline instead. */}
            <div className="flex flex-1 justify-center max-lg:hidden">{toolbar}</div>
            <div className="flex-1 lg:hidden" />

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <IconButton label="Notifications" className="max-sm:hidden">
                <Bell aria-hidden />
              </IconButton>
              <IconButton label="Help" className="max-sm:hidden">
                <CircleHelp aria-hidden />
              </IconButton>
              <ThemeToggle />

              <Menu>
                <MenuTrigger
                  aria-label="Account"
                  className="rounded-[var(--radius-pill)] pl-0.5 transition-colors hover:bg-surface-sunken sm:pr-2.5"
                >
                  <UserPill name={user.name} meta={user.email} />
                </MenuTrigger>
                <MenuContent>
                  <div className="px-2.5 py-2">
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="truncate text-xs text-ink-subtle">{user.email}</p>
                  </div>
                  <MenuSeparator />
                  <MenuItem asChild>
                    <Link href="/settings">Settings</Link>
                  </MenuItem>
                  <MenuSeparator />
                  <MenuItem destructive>Sign out</MenuItem>
                </MenuContent>
              </Menu>
            </div>
          </header>

          <main className="thin-scroll min-w-0 flex-1 px-4 pt-2 pb-8 sm:px-6 md:overflow-y-auto md:pb-10">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
