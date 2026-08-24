"use client";

import { BarChart3, House, Layers, MessageSquare, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ComponentType } from "react";
import { Logo, PawMark } from "@/components/shared/Logo";
import { QuotaMeter } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * One navigation, three containers: 240px sidebar, 72px icon rail, drawer.
 *
 * Pawgress is a website, so this is a persistent sidebar rather than a bottom
 * tab bar — bottom tabs are native-app chrome and fight the browser's own
 * bottom bar and the on-screen keyboard (docs/navigation.md §1).
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

function NavLink({
  item,
  current,
  compact,
  onNavigate,
}: {
  item: NavItem;
  current: boolean;
  compact: boolean;
  onNavigate?: () => void;
}) {
  const { href, label, Icon } = item;
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={current ? "page" : undefined}
      title={compact ? label : undefined}
      className={cn(
        "flex items-center gap-3 rounded-[var(--radius-control)] px-3 py-2.5 text-[0.9375rem] transition-colors",
        compact && "justify-center px-0",
        current
          ? "bg-surface-sunken font-semibold text-ink"
          : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
      )}
    >
      <Icon className="size-[1.125rem] shrink-0" aria-hidden />
      <span className={cn(compact && "sr-only")}>{label}</span>
    </Link>
  );
}

export type SideNavProps = {
  /** Icon-rail mode, used between 768px and 1024px. */
  compact?: boolean;
  /** Called after a link is followed — closes the drawer on narrow viewports. */
  onNavigate?: () => void;
  quota?: { used: number; limit: number; resetsAt: string };
  className?: string;
};

export function SideNav({ compact = false, onNavigate, quota, className }: SideNavProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className={cn(
        "flex h-full flex-col gap-1 border-r border-rule bg-paper py-4",
        compact ? "w-[4.5rem] px-3" : "w-60 px-3",
        className,
      )}
    >
      <div className={cn("mb-4 px-2", compact && "flex justify-center px-0")}>
        <Link href="/dashboard" aria-label="Pawgress home">
          {compact ? <PawMark className="size-7" /> : <Logo />}
        </Link>
      </div>

      {PRIMARY.map((item) => (
        <NavLink
          key={item.href}
          item={item}
          current={isCurrent(pathname, item.href)}
          compact={compact}
          onNavigate={onNavigate}
        />
      ))}

      <div className="mt-auto flex flex-col gap-1">
        {SECONDARY.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            current={isCurrent(pathname, item.href)}
            compact={compact}
            onNavigate={onNavigate}
          />
        ))}

        {/* A limit that only shows up when it blocks you is a bug (NFR-C1). */}
        {quota && !compact && (
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
