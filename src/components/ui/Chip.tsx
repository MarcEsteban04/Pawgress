import { FileText } from "lucide-react";
import { type ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Chips replace dropdowns wherever the option set is small — topic, question
 * count, difficulty. Three taps beats opening a picker, and the whole option
 * set stays visible.
 *
 * Selected is an ink fill, matching every other solid control in "Daylight".
 *
 * Two sizes on purpose: `md` is the 44px touch target used anywhere a student
 * is choosing something (quiz setup, filters on a phone); `sm` is the 32px
 * chrome toggle used in dashboard headers, where the pointer is a mouse and a
 * 44px pill would overwhelm the panel it sits in.
 */
export function Chip({
  className,
  selected = false,
  size = "md",
  ...props
}: ComponentProps<"button"> & { selected?: boolean; size?: "sm" | "md" }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "inline-flex items-center gap-2 rounded-[var(--radius-pill)]",
        "whitespace-nowrap transition-colors",
        size === "sm" ? "h-8 px-3.5 text-sm" : "h-11 px-4 text-[0.9375rem]",
        selected
          ? "bg-ink font-medium text-on-ink shadow-[var(--shadow-pill)]"
          : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
        className,
      )}
      {...props}
    />
  );
}

/**
 * The pill track a set of chips sits in — the segmented control in the top bar.
 * Horizontally scrollable at narrow widths rather than wrapping unpredictably.
 */
export function ChipGroup({
  className,
  inset = false,
  ...props
}: ComponentProps<"div"> & { inset?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 max-sm:overflow-x-auto",
        inset && "rounded-[var(--radius-pill)] border border-rule bg-surface p-1",
        !inset && "flex-wrap gap-2 max-sm:flex-nowrap",
        className,
      )}
      {...props}
    />
  );
}

/** A static, non-interactive tag — subject labels, question types. */
export function Tag({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-surface-sunken px-2.5 py-1 text-xs font-medium text-ink-muted",
        className,
      )}
      {...props}
    />
  );
}

export type SourceChipProps = {
  /** Material name, e.g. "Lecture 4.pdf". */
  material: string;
  /** Page or slide number, when known. */
  page?: number;
  href?: string;
  className?: string;
};

/**
 * A citation. These are the product — an assistant answer or a reviewer section
 * without one, where retrieval was expected to find something, is a defect
 * rather than a styling choice (docs/branding.md §1, product principle 1).
 *
 * Rendered as a real link so ctrl-click opens the material in a new tab.
 */
export function SourceChip({ material, page, href, className }: SourceChipProps) {
  const label = page ? `${material} · p.${page}` : material;
  const inner = (
    <>
      <FileText className="size-3.5 shrink-0" aria-hidden />
      <span className="tabular text-xs">{label}</span>
    </>
  );
  const styles = cn(
    "inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-rule bg-surface px-2.5 py-1 text-ink-muted",
    href && "transition-colors hover:border-rule-strong hover:text-ink",
    className,
  );

  if (!href) return <span className={styles}>{inner}</span>;
  return (
    <a href={href} className={styles} aria-label={`Open ${label}`}>
      {inner}
    </a>
  );
}
