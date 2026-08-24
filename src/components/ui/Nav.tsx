import Link from "next/link";
import { type ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * The subject hub's Materials / Reviewers / Quizzes / Progress switcher.
 *
 * These are real routes, so this is a set of LINKS, not a JavaScript tab widget.
 * That keeps each view linkable, reloadable and openable in a new tab
 * (docs/navigation.md §1) — and it needs no client JavaScript at all.
 */

export function SegmentedNav({ className, ...props }: ComponentProps<"nav">) {
  return (
    <nav
      className={cn("flex gap-6 overflow-x-auto border-b border-rule max-sm:gap-4", className)}
      {...props}
    />
  );
}

export type SegmentedNavItemProps = {
  href: string;
  current?: boolean;
  children: React.ReactNode;
  className?: string;
};

export function SegmentedNavItem({ href, current, children, className }: SegmentedNavItemProps) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "-mb-px shrink-0 border-b-2 pb-2.5 text-[0.9375rem] whitespace-nowrap transition-colors",
        current
          ? "border-ink font-semibold text-ink"
          : "border-transparent text-ink-muted hover:text-ink",
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
  size?: "sm" | "md";
  className?: string;
};

/**
 * Avatar with initials fallback. No image library: an avatar is one `<img>`, and
 * `next/image` earns its keep on content images, not on a 32px circle.
 */
export function Avatar({ name, src, size = "md", className }: AvatarProps) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  const box = size === "sm" ? "size-7 text-[0.6875rem]" : "size-9 text-xs";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-rule bg-surface-sunken font-semibold text-ink-muted",
        box,
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- 32px avatar; the optimizer adds no value here
        <img src={src} alt={name} className="size-full object-cover" />
      ) : (
        <span aria-hidden>{initials || "?"}</span>
      )}
      <span className="sr-only">{name}</span>
    </span>
  );
}
