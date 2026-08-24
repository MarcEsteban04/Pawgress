import Link from "next/link";
import { type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The subject hub's Materials / Reviewers / Quizzes / Progress switcher, and
 * the dashboard's range switcher.
 *
 * These are real routes, so this is a set of LINKS, not a JavaScript tab widget.
 * That keeps each view linkable, reloadable and openable in a new tab
 * (docs/navigation.md §1) — and it needs no client JavaScript at all.
 *
 * "Daylight" renders them as a pill track with an ink pill on the current item,
 * matching every other selected control in the system.
 */
export function SegmentedNav({ className, ...props }: ComponentProps<"nav">) {
  return (
    <nav
      className={cn(
        "inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-rule bg-surface p-1",
        "max-w-full overflow-x-auto",
        className,
      )}
      {...props}
    />
  );
}

export type SegmentedNavItemProps = {
  href: string;
  current?: boolean;
  children: ReactNode;
  className?: string;
};

export function SegmentedNavItem({ href, current, children, className }: SegmentedNavItemProps) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "inline-flex h-8 shrink-0 items-center rounded-[var(--radius-pill)] px-3.5 text-sm whitespace-nowrap transition-colors",
        current
          ? "bg-ink font-medium text-on-ink shadow-[var(--shadow-pill)]"
          : "text-ink-muted hover:text-ink",
        className,
      )}
    >
      {children}
    </Link>
  );
}

export type AvatarProps = {
  /** Display name — used for the fallback initials and the accessible label. */
  name: string;
  src?: string | null;
  size?: "sm" | "md" | "lg";
  /**
   * Categorical slot for the initials fallback. Identity only — an avatar tint
   * never means anything about the person.
   */
  tone?: 1 | 2 | 3 | 4 | 5;
  className?: string;
};

const AVATAR_TONES = {
  1: "bg-cat-1-soft text-cat-1",
  2: "bg-cat-2-soft text-cat-2",
  3: "bg-cat-3-soft text-cat-3",
  4: "bg-cat-4-soft text-cat-4",
  5: "bg-cat-5-soft text-cat-5",
} as const;

/**
 * Avatar with initials fallback. No image library: an avatar is one `<img>`, and
 * `next/image` earns its keep on content images, not on a 36px circle.
 */
export function Avatar({ name, src, size = "md", tone, className }: AvatarProps) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  const box =
    size === "sm"
      ? "size-8 text-[0.6875rem]"
      : size === "lg"
        ? "size-11 text-sm"
        : "size-9 text-xs";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold",
        tone ? AVATAR_TONES[tone] : "bg-surface-sunken text-ink-muted",
        box,
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- 36px avatar; the optimizer adds no value here
        <img src={src} alt={name} className="size-full object-cover" />
      ) : (
        <span aria-hidden>{initials || "?"}</span>
      )}
      <span className="sr-only">{name}</span>
    </span>
  );
}

/**
 * Avatar plus name and a line of context, as in the top-right of the shell.
 * The text half is hidden below `sm` — at 360px the avatar alone has to carry
 * it, and truncating a name to three characters helps nobody.
 */
export function UserPill({
  name,
  meta,
  src,
  className,
}: {
  name: string;
  meta?: string;
  src?: string | null;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Avatar name={name} src={src} tone={1} />
      <span className="hidden min-w-0 flex-col text-left leading-tight sm:flex">
        <span className="truncate text-sm font-medium">{name}</span>
        {meta && <span className="truncate text-xs text-ink-subtle">{meta}</span>}
      </span>
    </span>
  );
}
