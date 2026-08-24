"use client";

import { BarChart3, House, Layers, MessageSquare, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ComponentType } from "react";
import { AppMark } from "@/components/shared/Logo";
import { QuotaMeter } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * One navigation, two containers: a 72px icon rail inside the canvas, and a
 * labelled drawer below 768px.
 *
 * Pawgress is a website, so this is a persistent rail rather than a bottom tab
 * bar — bottom tabs are native-app chrome and fight the browser's own bottom
 * bar and the on-screen keyboard (docs/navigation.md §1).
 *
 * The rail is icon-only, which is only defensible because each item carries a
 * real accessible name AND a hover/focus tooltip. Five destinations is inside
 * what an icon rail can carry; a sixth would need labels back.
 *
 * Client Component because the current route drives the active item.
 */

type NavItem = {
  href: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
};

const PRIMARY: NavItem[] = [
  { href: "/dashboard", label: "Home", Icon: House },
  { href: "/subjects", label: "Subjects", Icon: Layers },
  { href: "/assistant", label: "Ask", Icon: MessageSquare },
  { href: "/progress", label: "Progress", Icon: BarChart3 },
];

const SECONDARY: NavItem[] = [{ href: "/settings", label: "Settings", Icon: Settings }];

function isCurrent(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function RailLink({
  item,
  current,
  onNavigate,
}: {
  item: NavItem;
  current: boolean;
  onNavigate?: () => void;
}) {
  const { href, label, Icon } = item;
  return (
    <li className="group relative flex justify-center">
      <Link
        href={href}
        onClick={onNavigate}
        aria-current={current ? "page" : undefined}
        className={cn(
          "flex size-11 items-center justify-center rounded-full transition-colors",
          current
            ? "bg-ink text-on-ink shadow-[var(--shadow-pill)]"
            : "text-ink-subtle hover:bg-surface-sunken hover:text-ink",
        )}
      >
        <Icon className="size-[1.125rem]" aria-hidden />
        <span className="sr-only">{label}</span>
      </Link>

      {/* Tooltip. `sr-only` above carries the name for assistive tech; this is
          for the sighted student who does not recognise the glyph. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-1/2 left-full z-50 ml-2 -translate-y-1/2",
          "rounded-[var(--radius-control)] bg-ink px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-on-ink",
          "opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100",
        )}
      >
        {label}
      </span>
    </li>
  );
}

function DrawerLink({
  item,
  current,
  onNavigate,
}: {
  item: NavItem;
  current: boolean;
  onNavigate?: () => void;
}) {
  const { href, label, Icon } = item;
  return (
    <li>
      <Link
        href={href}
        onClick={onNavigate}
        aria-current={current ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 rounded-[var(--radius-pill)] px-4 py-3 text-[0.9375rem] transition-colors",
          current
            ? "bg-ink font-medium text-on-ink"
            : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
        )}
      >
        <Icon className="size-[1.125rem] shrink-0" aria-hidden />
        {label}
      </Link>
    </li>
  );
}

export type SideNavProps = {
  /** Labelled drawer mode, used below 768px. */
  drawer?: boolean;
  /** Called after a link is followed — closes the drawer on narrow viewports. */
  onNavigate?: () => void;
  quota?: { used: number; limit: number; resetsAt: string };
  className?: string;
};

export function SideNav({ drawer = false, onNavigate, quota, className }: SideNavProps) {
  const pathname = usePathname();
  const Item = drawer ? DrawerLink : RailLink;

  return (
    <nav
      aria-label="Main"
      className={cn(
        "flex h-full flex-col",
        drawer ? "w-[17rem] gap-1 bg-frame p-4" : "w-[4.5rem] items-center gap-1.5 py-5",
        className,
      )}
    >
      <div className={cn("mb-4", drawer && "px-2")}>
        <Link href="/dashboard" aria-label="Pawgress home">
          <AppMark />
        </Link>
      </div>

      <ul className={cn("flex flex-col gap-1.5", drawer && "w-full gap-1")}>
        {PRIMARY.map((item) => (
          <Item
            key={item.href}
            item={item}
            current={isCurrent(pathname, item.href)}
            onNavigate={onNavigate}
          />
        ))}
      </ul>

      <div className={cn("mt-auto flex flex-col gap-1.5", drawer && "w-full gap-1")}>
        <ul className={cn("flex flex-col gap-1.5", drawer && "gap-1")}>
          {SECONDARY.map((item) => (
            <Item
              key={item.href}
              item={item}
              current={isCurrent(pathname, item.href)}
              onNavigate={onNavigate}
            />
          ))}
        </ul>

        {/* A limit that only shows up when it blocks you is a bug (NFR-C1).
            The rail has no room for a meter, so it appears in the drawer and in
            Settings; the rail keeps the quota out of the way, not hidden. */}
        {quota && drawer && (
          <div className="mt-3 border-t border-rule px-2 pt-4">
            <QuotaMeter
              label="AI today"
              used={quota.used}
              limit={quota.limit}
              resetsAt={quota.resetsAt}
            />
          </div>
        )}
      </div>
    </nav>
  );
}
