"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button, Chip, ChipGroup, IconButton } from "@/components/ui";
import { type DateKey } from "@/features/planner/dates";
import {
  PLANNER_VIEWS,
  periodLabel,
  plannerHref,
  shift,
  VIEW_LABEL,
  type PlannerView,
} from "@/features/planner/view";
import { cn } from "@/lib/utils";

/**
 * Where you are, and how to move (Sprint 61).
 *
 * **Every control here writes the URL**, which is what makes a week linkable
 * and the back button undo a page rather than leaving the calendar. It also
 * means the arrows are ordinary navigations: the server fetches the new range
 * and nothing has to be kept in sync on the client.
 *
 * `push`, not `replace` — unlike a filter bar. Paging through October is
 * movement a student expects to be able to walk back out of, and each step is
 * a deliberate act rather than a keystroke in a search box.
 *
 * **"Today" is always offered, even when it would change nothing.** A control
 * that appears only once you are lost is one you have to learn exists first.
 */
export function PlannerNav({
  view,
  anchor,
  today,
}: {
  view: PlannerView;
  anchor: DateKey;
  today: DateKey;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function go(href: string) {
    startTransition(() => router.push(href, { scroll: false }));
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3",
        isPending && "opacity-70 transition-opacity",
      )}
    >
      <div className="flex items-center gap-1">
        <IconButton
          label="Previous"
          size="sm"
          onClick={() => go(plannerHref(view, shift(view, anchor, -1), today))}
        >
          <ChevronLeft aria-hidden />
        </IconButton>
        <IconButton
          label="Next"
          size="sm"
          onClick={() => go(plannerHref(view, shift(view, anchor, 1), today))}
        >
          <ChevronRight aria-hidden />
        </IconButton>
      </div>

      {/* `aria-live` because the arrows change this and nothing else visible
          announces the move. Polite: a student paging quickly should not have
          each month interrupt the last. */}
      <p
        aria-live="polite"
        className="min-w-0 flex-1 truncate font-display text-lg font-semibold tracking-[-0.015em]"
      >
        {periodLabel(view, anchor)}
      </p>

      <Button variant="subtle" size="sm" onClick={() => go(plannerHref(view, today, today))}>
        Today
      </Button>

      <ChipGroup inset>
        {PLANNER_VIEWS.map((option) => (
          <Chip
            key={option}
            size="sm"
            selected={view === option}
            onClick={() => go(plannerHref(option, anchor, today))}
          >
            {VIEW_LABEL[option]}
          </Chip>
        ))}
      </ChipGroup>
    </div>
  );
}
