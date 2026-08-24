import { FileText } from "lucide-react";
import { type ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Chips replace dropdowns wherever the option set is small — topic, question
 * count, difficulty. Three taps beats opening a picker, and the whole option
 * set stays visible.
 */
export function Chip({
  className,
  selected = false,
  ...props
}: ComponentProps<"button"> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "inline-flex h-11 items-center gap-2 rounded-[var(--radius-pill)] border px-4",
        "text-[0.9375rem] whitespace-nowrap transition-colors",
        selected
          ? "border-ink bg-ink font-semibold text-paper"
          : "border-rule bg-surface text-ink hover:border-rule-strong",
        className,
      )}
      {...props}
    />
  );
}

/** Horizontally scrollable at narrow widths rather than wrapping unpredictably. */
export function ChipGroup({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-wrap gap-2 max-sm:flex-nowrap max-sm:overflow-x-auto", className)}
      {...props}
    />
  );
}

/** A static, non-interactive tag — subject labels, question types. */
export function Tag({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-rule bg-surface-sunken px-2.5 py-1 text-xs text-ink-muted",
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
      <FileText className="size-3 shrink-0" aria-hidden />
      <span className="font-mono text-xs">{label}</span>
    </>
  );
  const styles = cn(
    "inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-rule bg-surface px-2 py-1 text-ink-muted",
    href && "transition-colors hover:border-ink hover:text-ink",
    className,
  );

  if (!href) return <span className={styles}>{inner}</span>;
  return (
    <a href={href} className={styles} aria-label={`Open ${label}`}>
      {inner}
    </a>
  );
}
