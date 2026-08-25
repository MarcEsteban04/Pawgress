"use client";

import {
  BarChart3,
  House,
  Layers,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ComponentType } from "react";
import { AppMark } from "@/components/shared/Logo";
import { QuotaMeter } from "@/components/ui";
import { type SidebarState } from "@/features/shell/sidebar";
import { cn } from "@/lib/utils";

/**
 * One navigation, three widths: expanded (240px), collapsed (72px), and a
 * labelled drawer below 768px.
 *
 * Pawgress is a website, so this is a persistent sidebar rather than a bottom
 * tab bar — bottom tabs are native-app chrome and fight the browser's own
 * bottom bar and the on-screen keyboard (docs/navigation.md §1).
 *
 * Collapsing is a real preference, remembered in a cookie so the server renders
 * the right width and nothing snaps after hydration. Expanded is the default:
 * icon-only navigation is a compromise, and it should be one a student opts
 * into rather than one they have to discover their way out of.
 *
 * Client Component because the current route drives the active item.
 */

type NavItem = {
  href: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
  /** Shown in the tooltip and read by assistive tech. */
  hint: string;
};

const SECTIONS: { heading: string; items: NavItem[] }[] = [
  {
    heading: "Study",
    items: [
      { href: "/dashboard", label: "Home", Icon: House, hint: "What to study today" },
      { href: "/subjects", label: "Subjects", Icon: Layers, hint: "Your classes and files" },
      {
        href: "/assistant",
        label: "Ask",
        Icon: MessageSquare,
        hint: "Questions about your material",
      },
      { href: "/progress", label: "Progress", Icon: BarChart3, hint: "Mastery and quiz history" },
    ],
  },
  {
    heading: "Account",
    items: [
      { href: "/settings", label: "Settings", Icon: Settings, hint: "Profile and appearance" },
    ],
  },
];

function isCurrent(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  item,
  current,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  current: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const { href, label, Icon, hint } = item;

  return (
    <li className="group relative">
      <Link
        href={href}
        onClick={onNavigate}
        aria-current={current ? "page" : undefined}
        className={cn(
          "relative flex items-center rounded-[var(--radius-pill)] transition-colors",
          collapsed ? "size-11 justify-center" : "h-11 gap-3 px-3.5",
          current
            ? "bg-ink font-medium text-on-ink shadow-[var(--shadow-pill)]"
            : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
        )}
      >
        <Icon className="size-[1.125rem] shrink-0" aria-hidden />
        {/* The label is removed from the tree when collapsed rather than hidden
            with CSS — a width transition on a wrapping label looks broken, and
            the tooltip already carries the name for assistive tech. */}
        {collapsed ? (
          <span className="sr-only">{label}</span>
        ) : (
          <span className="truncate text-[0.9375rem]">{label}</span>
        )}
      </Link>

      {/* Only when collapsed. An expanded item already shows its name, and a
          tooltip repeating it is noise that covers the item beside it. */}
      {collapsed && (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute top-1/2 left-full z-50 ml-2 -translate-y-1/2",
            "rounded-[var(--radius-control)] bg-ink px-2.5 py-1.5 whitespace-nowrap text-on-ink",
            "opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100",
          )}
        >
          <span className="block text-xs font-medium">{label}</span>
          <span className="block text-[0.6875rem] opacity-70">{hint}</span>
        </span>
      )}
    </li>
  );
}

export type SideNavProps = {
  state: SidebarState;
  onToggle?: () => void;
  /** Labelled drawer mode, used below 768px. Never collapsed. */
  drawer?: boolean;
  onNavigate?: () => void;
  quota?: { used: number; limit: number; resetsAt: string };
  className?: string;
};

export function SideNav({
  state,
  onToggle,
  drawer = false,
  onNavigate,
  quota,
  className,
}: SideNavProps) {
  const pathname = usePathname();
  const collapsed = !drawer && state === "collapsed";

  return (
    <nav
      aria-label="Main"
      className={cn(
        "flex h-full flex-col border-r border-rule bg-frame",
        // The width itself is the animation. Everything inside is laid out for
        // the width it is at, so nothing has to slide independently.
        "transition-[width] duration-200 ease-out motion-reduce:transition-none",
        drawer ? "w-[17rem] p-4" : collapsed ? "w-[4.5rem] px-3 py-5" : "w-60 px-3 py-5",
        className,
      )}
    >
      <div className={cn("mb-6 flex items-center", collapsed ? "justify-center" : "gap-2 px-1")}>
        <Link href="/dashboard" aria-label="Pawgress home" className="shrink-0">
          <AppMark />
        </Link>
        {!collapsed && (
          <span className="truncate font-display text-[1.0625rem] leading-none font-semibold tracking-[-0.02em]">
            Pawgress
          </span>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-6">
        {SECTIONS.map((section) => (
          <div key={section.heading} className="flex flex-col gap-1">
            {/* A heading above a single item would be noise when collapsed, and
                there is no room for it anyway. */}
            {!collapsed && (
              <p className="px-3.5 pb-1 text-[0.6875rem] font-semibold tracking-[0.08em] text-ink-subtle uppercase">
                {section.heading}
              </p>
            )}
            <ul className={cn("flex flex-col gap-1", collapsed && "items-center gap-1.5")}>
              {section.items.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  current={isCurrent(pathname, item.href)}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                />
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-auto flex flex-col gap-3 pt-4">
        {/* A limit that only appears when it blocks you is a bug (NFR-C1). It
            needs room to be readable, so the collapsed rail omits it rather
            than showing an unlabelled sliver. */}
        {quota && !collapsed && (
          <div className="border-t border-rule px-1 pt-4">
            <QuotaMeter
              label="AI today"
              used={quota.used}
              limit={quota.limit}
              resetsAt={quota.resetsAt}
            />
          </div>
        )}

        {!drawer && onToggle && (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "flex items-center rounded-[var(--radius-pill)] text-ink-subtle transition-colors hover:bg-surface-sunken hover:text-ink",
              collapsed ? "size-11 justify-center self-center" : "h-10 gap-3 px-3.5",
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-[1.125rem]" aria-hidden />
            ) : (
              <>
                <PanelLeftClose className="size-[1.125rem] shrink-0" aria-hidden />
                <span className="text-sm">Collapse</span>
              </>
            )}
          </button>
        )}
      </div>
    </nav>
  );
}
