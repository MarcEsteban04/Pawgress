"use client";

import { Menu as MenuIcon, Search, X } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { SideNav } from "./SideNav";
import { ThemeToggle } from "./ThemeToggle";
import { Avatar, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui";

/**
 * The authenticated shell: sidebar + top bar + content column.
 *
 * Responsive behaviour is one component in three containers, not two builds —
 * 240px sidebar from 1024px, 72px icon rail from 768px, drawer below that
 * (docs/navigation.md §5).
 *
 * Client Component because the drawer holds open/closed state. Pages rendered
 * into `children` stay Server Components: the shell is the only client boundary.
 */

export type AppShellProps = {
  children: ReactNode;
  /** Breadcrumb trail, deepest last. Rendered from 768px up. */
  breadcrumbs?: { label: string; href?: string }[];
  user: { name: string; email: string };
  quota?: { used: number; limit: number; resetsAt: string };
};

export function AppShell({ children, breadcrumbs = [], user, quota }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-dvh">
      {/* Persistent sidebar — rail from 768px, full from 1024px */}
      <div className="sticky top-0 hidden h-dvh md:block lg:hidden">
        <SideNav compact />
      </div>
      <div className="sticky top-0 hidden h-dvh lg:block">
        <SideNav quota={quota} />
      </div>

      {/* Drawer, below 768px */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            aria-label="Close navigation"
            className="absolute inset-0 bg-[color-mix(in_oklab,var(--ink)_45%,transparent)]"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 shadow-xl">
            <SideNav quota={quota} onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-rule bg-paper/95 px-4 backdrop-blur sm:px-6">
          <button
            aria-label="Open navigation"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
            className="-ml-1 flex size-9 items-center justify-center rounded-[var(--radius-control)] text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink md:hidden"
          >
            {drawerOpen ? <X className="size-5" /> : <MenuIcon className="size-5" />}
          </button>

          <nav aria-label="Breadcrumb" className="hidden min-w-0 flex-1 md:block">
            <ol className="flex items-center gap-2 text-sm text-ink-muted">
              {breadcrumbs.map((crumb, i) => {
                const last = i === breadcrumbs.length - 1;
                return (
                  <li key={`${crumb.label}-${i}`} className="flex min-w-0 items-center gap-2">
                    {i > 0 && <span aria-hidden>/</span>}
                    {crumb.href && !last ? (
                      <Link href={crumb.href} className="truncate transition-colors hover:text-ink">
                        {crumb.label}
                      </Link>
                    ) : (
                      <span
                        className={last ? "truncate font-semibold text-ink" : "truncate"}
                        aria-current={last ? "page" : undefined}
                      >
                        {crumb.label}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>

          <div className="flex-1 md:hidden" />

          {/* Search is a top-level affordance: a student with six subjects and
              thirty files needs it more than another button. Wired in Sprint 20. */}
          <button
            className="hidden h-9 w-56 items-center gap-2 rounded-[var(--radius-control)] border border-rule bg-surface px-3 text-sm text-ink-subtle transition-colors hover:border-rule-strong hover:text-ink-muted lg:flex"
            aria-label="Search subjects and files"
          >
            <Search className="size-4 shrink-0" aria-hidden />
            <span className="flex-1 text-left">Search</span>
            <kbd className="font-mono text-[0.625rem]">/</kbd>
          </button>
          <button
            aria-label="Search"
            className="flex size-9 items-center justify-center rounded-[var(--radius-control)] text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink lg:hidden"
          >
            <Search className="size-[1.125rem]" aria-hidden />
          </button>

          <ThemeToggle />

          <Menu>
            <MenuTrigger aria-label="Account" className="rounded-full">
              <Avatar name={user.name} size="sm" />
            </MenuTrigger>
            <MenuContent>
              <div className="px-2.5 py-2">
                <p className="text-sm font-semibold">{user.name}</p>
                <p className="truncate font-mono text-xs text-ink-subtle">{user.email}</p>
              </div>
              <MenuSeparator />
              <MenuItem asChild>
                <Link href="/settings">Settings</Link>
              </MenuItem>
              <MenuSeparator />
              <MenuItem destructive>Sign out</MenuItem>
            </MenuContent>
          </Menu>
        </header>

        <main className="mx-auto w-full max-w-[75rem] flex-1 px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
