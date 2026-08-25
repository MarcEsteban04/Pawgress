import { type LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * A single headline figure.
 *
 * The dataviz rules are explicit that when the story is one number, the answer
 * is a stat tile rather than a chart — a one-bar bar chart is the number with
 * extra steps (docs/design-system.md §3).
 *
 * The figure wears the display face and tabular figures so a changing count
 * neither jitters nor shifts voice. `hint` carries the evidence or the
 * qualifier; a bare number with no context is exactly what MasteryBar exists to
 * argue against.
 */
export function StatTile({
  label,
  value,
  hint,
  Icon,
  href,
  tone = "neutral",
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  Icon?: LucideIcon;
  /** Makes the whole tile a link, so the number is a way in rather than a fact. */
  href?: string;
  tone?: "neutral" | "accent";
  className?: string;
}) {
  const body = (
    <>
      <div className="flex items-center gap-2">
        {Icon && (
          <span
            className={cn(
              "flex size-7 items-center justify-center rounded-[0.625rem]",
              tone === "accent"
                ? "bg-accent-soft text-accent"
                : "bg-surface-sunken text-ink-subtle",
            )}
          >
            <Icon className="size-3.5" aria-hidden />
          </span>
        )}
        <span className="text-sm text-ink-muted">{label}</span>
      </div>

      <p className="tabular mt-3 font-display text-[1.75rem] leading-none font-semibold">{value}</p>
      {hint && <p className="mt-1.5 text-xs text-ink-subtle">{hint}</p>}
    </>
  );

  const shell = cn(
    "rounded-[var(--radius-card)] border border-rule bg-surface p-4 shadow-[var(--shadow-card)]",
    href && "transition-colors hover:border-rule-strong",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={cn(shell, "block")}>
        {body}
      </Link>
    );
  }

  return <div className={shell}>{body}</div>;
}
