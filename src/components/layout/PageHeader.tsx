import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The page head: a quiet eyebrow line, a large display title, and the page's
 * own controls on the right — the reference's "Manage and track your projects /
 * Project Dashboard / [search]" block, in Acadify's voice.
 *
 * On a website the primary action belongs in the page header, not pinned to the
 * bottom of the window — that is native-app chrome. Below 768px everything
 * stacks and the controls take a full-width row so they stay reachable.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  toolbar,
  className,
}: {
  /** The small line above the title. One short sentence, sentence case. */
  eyebrow?: string;
  title: string;
  description?: string;
  /**
   * Search, filters, or the page's primary button.
   *
   * The slot is a fixed 26rem so a search field has a stable width across
   * pages, and its contents are right-aligned inside it: a button is only as
   * wide as its label, and left-aligning it in a 26rem box leaves a gap at the
   * page edge that reads as a layout bug. Controls that should fill the slot
   * say so themselves — `SearchField` is `w-full`.
   */
  action?: ReactNode;
  /**
   * The same control the shell shows centred in the top bar. Rendered here
   * below `lg`, where the top bar has no room for it — so the control is never
   * simply missing at a narrower width.
   */
  toolbar?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {toolbar && <div className="lg:hidden">{toolbar}</div>}

      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="min-w-0 flex-1">
          {eyebrow && <p className="text-sm text-ink-muted">{eyebrow}</p>}
          <h1
            className={cn(
              "font-display text-[1.75rem] leading-tight font-semibold tracking-[-0.02em] sm:text-[2rem]",
              eyebrow && "mt-1",
            )}
          >
            {title}
          </h1>
          {description && (
            <p className="mt-2 max-w-[60ch] leading-relaxed text-ink-muted">{description}</p>
          )}
        </div>

        {action && (
          <div className="flex shrink-0 items-center justify-end gap-2 max-md:w-full md:w-[22rem] lg:w-[26rem]">
            {action}
          </div>
        )}
      </div>
    </div>
  );
}
