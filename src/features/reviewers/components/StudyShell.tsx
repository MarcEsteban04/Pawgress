import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { isValidElement, type ReactNode } from "react";
import { SUBJECT_TONE } from "@/features/subjects/components/SubjectIcon";
import { cn } from "@/lib/utils";

/**
 * The heading's own styling, exported so a caller supplying its own `<h1>`
 * looks identical to one passing a plain string. Two definitions of this would
 * drift the first time the bar is restyled.
 */
export const STUDY_TITLE =
  "truncate font-display text-lg leading-tight font-semibold tracking-[-0.01em] sm:text-xl";

/**
 * The frame every study screen sits in (Sprint 44–45).
 *
 * **Full width, full height, one bar of chrome.** These pages had a 52rem
 * column centred in a 1900px canvas: a flashcard the size of a paragraph
 * floating in an acre of nothing, which is the opposite of what the format is
 * for. Recall works when there is nothing else on screen — so the card takes
 * the screen, and everything that is not the card is compressed into a single
 * row at the top.
 *
 * **The subject's colour is the only decoration**, as a hairline across the top
 * and a tint behind the eyebrow. It is information, not ornament: four decks
 * open in four tabs are told apart by it.
 *
 * Shared rather than copied into both pages, because the flashcard deck and the
 * practice set are the same screen with different contents, and two copies
 * would have drifted by the second change.
 *
 * **This bar owns the page's `<h1>`, and it is the only one.** The reviewer page
 * used to pass the title here AND render it again above the document, so every
 * reviewer opened with its name printed twice and two competing `<h1>`s for a
 * screen reader to announce. A caller that needs the title to do something —
 * the reviewer's rename-in-place — passes an element instead of a string and
 * owns the heading itself; see `STUDY_TITLE` for the type to match.
 */
export function StudyShell({
  backHref,
  backLabel,
  eyebrow,
  title,
  colorSlot,
  actions,
  children,
}: {
  backHref: string;
  backLabel: string;
  eyebrow: string;
  /** A string gets the standard `<h1>`; an element must render its own. */
  title: ReactNode;
  colorSlot: 1 | 2 | 3 | 4 | 5;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const tone = SUBJECT_TONE[colorSlot];

  return (
    /* The app shell's own padding is cancelled here so this can genuinely reach
       the edges, then reapplied inside where it is wanted. A "full width" page
       that stops 2rem short on both sides is not one. */
    <div className="-mx-4 -my-4 flex min-h-[calc(100dvh-5.5rem)] flex-col sm:-mx-6 sm:-my-6 lg:-mx-8">
      <span className={cn("h-0.5 w-full shrink-0", tone.dot)} aria-hidden />

      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-rule bg-surface px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href={backHref}
          className="group inline-flex min-w-0 items-center gap-2 text-sm text-ink-muted transition-colors hover:text-ink"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-rule transition-colors group-hover:border-rule-strong group-hover:bg-surface-sunken">
            <ArrowLeft className="size-3.5" aria-hidden />
          </span>
          <span className="sr-only">Back to {backLabel}</span>
        </Link>

        <div className="min-w-0 flex-1">
          {/* `max-w-full truncate` because this now carries a subject AND a
              topic on the reviewer page, and a long pair used to push the bar
              wider than the viewport. */}
          <p
            className={cn(
              "inline-block max-w-full truncate rounded-[var(--radius-pill)] px-2 py-0.5 align-top text-[0.6875rem] font-semibold tracking-[0.08em] uppercase",
              tone.tint,
              tone.ink,
            )}
          >
            {eyebrow}
          </p>
          {isValidElement(title) ? title : <h1 className={cn("mt-1", STUDY_TITLE)}>{title}</h1>}
        </div>

        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>

      {/* Everything below the bar. `min-h-0` so a child that wants to fill the
          remaining height actually can — without it a flex child's default
          `min-height: auto` lets the card grow the page instead of fitting
          inside it. */}
      <div className="flex min-h-0 flex-1 flex-col px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        {children}
      </div>
    </div>
  );
}
