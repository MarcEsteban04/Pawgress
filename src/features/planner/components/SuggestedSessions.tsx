"use client";

import { CalendarCheck, Plus, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Button,
  Card,
  CardActions,
  CardBody,
  CardHeader,
  CardTitle,
  Chip,
  ChipGroup,
} from "@/components/ui";
import { SUBJECT_TONE } from "@/features/subjects/components/SubjectIcon";
import { addDays, longDayLabel, type DateKey } from "@/features/planner/dates";
import { addSuggestedSessionsAction, type SessionPick } from "@/features/planner/server/actions";
import { PER_DAY_COOKIE, PER_DAY_OPTIONS, type Suggestion } from "@/features/planner/suggest";
import { type SuggestionSet } from "@/server/planner/suggestions";
import { cn } from "@/lib/utils";

/**
 * Suggested study sessions for the next seven days (FR-N5, Sprint 64).
 *
 * **Every row says why.** "Revise Genetics · Thursday" is a calendar entry;
 * "Unit 3 exam in 9 days · you are weak on Genetics" is the reason to accept
 * it. A suggestion a student cannot see the reasoning behind is one they have
 * to trust, and the product has not earned that (docs/branding.md §1).
 *
 * **Nothing is written until they press Add.** Accepted suggestions become
 * planned study sessions and drop out of this list on the refresh, because the
 * scheduler counts them as already covered.
 *
 * **Availability is a control on the panel, not a settings page away.** The
 * one number that most changes what this suggests — how many sessions a day —
 * belongs beside the suggestions it changes, where the effect is immediate.
 */

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const VISIBLE_DAYS = 3;

function persistPerDay(value: number) {
  try {
    document.cookie = `${PER_DAY_COOKIE}=${value}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
  } catch {
    /* Blocked cookies: the choice lasts this page view. Fine for a preference. */
  }
}

function toPick(suggestion: Suggestion): SessionPick {
  return {
    dueOn: suggestion.dueOn,
    subjectId: suggestion.subjectId,
    topicId: suggestion.topicId,
    title: suggestion.title,
    notes: `Suggested: ${suggestion.reason}. About ${suggestion.minutes} minutes.`,
  };
}

export function SuggestedSessions({ set, today }: { set: SuggestionSet; today: DateKey }) {
  const router = useRouter();
  const [perDay, setPerDay] = useState(set.perDay);
  /* Keys mid-write, so their buttons dim; "all" while the whole week is. */
  const [busy, setBusy] = useState<Set<string> | "all" | null>(null);
  const [error, setError] = useState<string | null>(null);
  /* The first few days open, the rest behind a toggle: a full week at two a
     day is fourteen rows, and this sits above the deadline list. */
  const [expanded, setExpanded] = useState(false);
  const [, startTransition] = useTransition();

  const dayLabel = (day: DateKey) =>
    day === today ? "Today" : day === addDays(today, 1) ? "Tomorrow" : longDayLabel(day);

  function changePerDay(value: number) {
    setPerDay(value);
    persistPerDay(value);
    /* The suggestions are worked out on the server from this cookie. */
    router.refresh();
  }

  function add(items: Suggestion[], all = false) {
    setError(null);
    setBusy(all ? "all" : new Set(items.map((item) => item.key)));
    startTransition(async () => {
      const result = await addSuggestedSessionsAction(items.map(toPick));
      if (result.status === "error") setError(`${result.message} ${result.nextStep}`);
      router.refresh();
      setBusy(null);
    });
  }

  const isBusy = (key: string) => busy === "all" || (busy instanceof Set && busy.has(key));

  const byDay = new Map<DateKey, Suggestion[]>();
  for (const suggestion of set.suggestions) {
    const list = byDay.get(suggestion.dueOn);
    if (list) list.push(suggestion);
    else byDay.set(suggestion.dueOn, [suggestion]);
  }
  const allDays = [...byDay.entries()];
  const shownDays = expanded ? allDays : allDays.slice(0, VISIBLE_DAYS);
  const hiddenCount = allDays
    .slice(VISIBLE_DAYS)
    .reduce((total, [, items]) => total + items.length, 0);

  return (
    <Card>
      <CardHeader className="flex-wrap">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-ink-subtle" aria-hidden />
            Suggested sessions
          </CardTitle>
          <p className="mt-1 text-sm text-ink-muted">
            The next 7 days, worked out from your deadlines and weak topics. {set.minutes}-minute
            sessions — change that in Settings.
          </p>
        </div>

        <CardActions className="max-sm:ml-0 max-sm:w-full max-sm:justify-between">
          <ChipGroup role="group" aria-label="Sessions a day">
            {PER_DAY_OPTIONS.map((option) => (
              <Chip
                key={option}
                size="sm"
                selected={perDay === option}
                onClick={() => changePerDay(option)}
              >
                {option} a day
              </Chip>
            ))}
          </ChipGroup>
          {set.suggestions.length > 1 && (
            <Button
              variant="primary"
              size="sm"
              disabled={busy !== null}
              onClick={() => add(set.suggestions, true)}
            >
              <Plus aria-hidden />
              {busy === "all" ? "Adding…" : `Add all ${set.suggestions.length}`}
            </Button>
          )}
        </CardActions>
      </CardHeader>

      <CardBody className="flex flex-col gap-4">
        {set.suggestions.length === 0 ? (
          <Empty set={set} />
        ) : (
          shownDays.map(([day, items]) => (
            <section key={day} className="flex flex-col gap-1.5">
              <h3 className="text-xs font-semibold tracking-[0.08em] text-ink-subtle uppercase">
                {dayLabel(day)}
              </h3>
              <ul className="flex flex-col divide-y divide-rule rounded-[var(--radius-card)] border border-rule">
                {items.map((item) => {
                  const tone = SUBJECT_TONE[item.colorSlot];
                  return (
                    <li key={item.key} className="flex items-center gap-3 px-4 py-3">
                      <span aria-hidden className={cn("size-2 shrink-0 rounded-full", tone.dot)} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {item.title}
                          <span className="font-normal text-ink-muted"> · {item.subjectName}</span>
                        </span>
                        <span className="mt-0.5 block text-sm text-ink-muted first-letter:uppercase">
                          {item.reason}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-ink-subtle tabular-nums max-sm:hidden">
                        {item.minutes} min
                      </span>
                      <Button
                        variant="subtle"
                        size="sm"
                        disabled={busy !== null}
                        onClick={() => add([item])}
                        aria-label={`Add ${item.title} on ${dayLabel(day)}`}
                      >
                        <Plus aria-hidden />
                        {isBusy(item.key) ? "Adding…" : "Add"}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}

        {hiddenCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            aria-expanded={expanded}
            onClick={() => setExpanded((open) => !open)}
          >
            {expanded ? "Show fewer days" : `${hiddenCount} more later in the week`}
          </Button>
        )}

        {set.unplaced > 0 && (
          <p className="text-sm text-warn">
            {set.unplaced === 1 ? "One more session" : `${set.unplaced} more sessions`} would not
            fit at {perDay} a day.
            {perDay < PER_DAY_OPTIONS[PER_DAY_OPTIONS.length - 1]
              ? " Allow more sessions a day to see them."
              : " Your week is full — some of this will have to come from longer sessions."}
          </p>
        )}

        {error && (
          <p role="alert" className="text-sm text-bad">
            {error}
          </p>
        )}
      </CardBody>
    </Card>
  );
}

function Empty({ set }: { set: SuggestionSet }) {
  /* Something to plan around, and the week already covers it: say so as the
     good news it is. */
  if (set.hasInputs) {
    return (
      <p className="flex items-center gap-2.5 text-sm text-ink-muted">
        <CalendarCheck className="size-4 shrink-0 text-good" aria-hidden />
        Your planned sessions already cover what is coming up this week.
      </p>
    );
  }

  if (set.nextRunUp) {
    return (
      <p className="text-sm text-ink-muted">
        Nothing needs revising yet. Sessions for{" "}
        <span className="font-medium text-ink">{set.nextRunUp.title}</span> will be suggested from{" "}
        {longDayLabel(set.nextRunUp.startsOn)}, when its run-up starts.
      </p>
    );
  }

  return (
    <p className="text-sm text-ink-muted">
      Nothing to plan around yet. Add an exam or deadline with its subject, or answer some practice
      questions, and sessions will be suggested here.
    </p>
  );
}
