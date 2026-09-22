import { Brain, CalendarCheck, Flame, Layers, ListChecks, Target, Timer } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  MasteryBar,
  SectionLabel,
  StatTile,
  buttonStyles,
} from "@/components/ui";
import { SUBJECT_TONE } from "@/features/subjects/components/SubjectIcon";
import {
  LOW_EVIDENCE_QUESTIONS,
  getProgressOverview,
  type ActivityDay,
  type RecentSession,
} from "@/server/progress/queries";
import { cn } from "@/lib/utils";

/**
 * Progress (FR-P1, US-H1).
 *
 * **Everything here is counted, not modelled.** Minutes studied, questions
 * answered, cards recalled, days in a row. The weighted mastery formula with
 * recency and difficulty is Sprint 56's; a half-invented version of it here
 * would put the "mastery misleads students" risk on screen early, and this page
 * exists precisely because the product was previously claiming nothing at all.
 *
 * **Recall and accuracy sit side by side and are never averaged.** Pressing "I
 * had it" on a flashcard is a student's own judgement; answering a multiple
 * choice is evidence. One percentage covering both would mean neither.
 *
 * **Nothing is shown as a percentage below ten answered questions.**
 * `MasteryBar` enforces that and this page respects it everywhere — a figure
 * from three answers is noise dressed as measurement.
 */

export const metadata = { title: "Progress" };

export default async function Page() {
  const data = await getProgressOverview();

  if (data.totalSessions === 0) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          eyebrow="What you know, and what you do not yet"
          title="Progress"
          description="Every finished flashcard deck and practice set lands here."
        />
        <EmptyState
          Icon={Target}
          title="Nothing measured yet"
          description="Finish a flashcard deck or a practice set and it shows up here — how long you studied, how much you recalled, and which topics are holding you back. Nothing is recorded until you finish a set, so a half-done run costs you nothing."
          action={
            <Link href="/reviewers" className={buttonStyles({ variant: "accent" })}>
              Go to your reviewers
            </Link>
          }
        />
      </div>
    );
  }

  const accuracy = data.answered > 0 ? data.correct / data.answered : null;
  const recall = data.cardsSeen > 0 ? data.cardsKnown / data.cardsSeen : null;
  const measured = data.topics.filter((topic) => topic.answered >= LOW_EVIDENCE_QUESTIONS);
  const weakest = measured.slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="What you know, and what you do not yet"
        title="Progress"
        description="Counted from what you have actually finished — not estimated."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Studied"
          value={formatMinutes(data.totalMinutes)}
          hint={`${data.totalSessions} ${data.totalSessions === 1 ? "session" : "sessions"}`}
          Icon={Timer}
        />
        <StatTile
          label="Day streak"
          value={data.streak}
          /* Said plainly, because a streak that looks like it might already be
             lost is a streak someone stops trying to keep. */
          hint={data.streak > 0 ? "Study today to keep it" : "Finish a set to start one"}
          Icon={Flame}
          tone={data.streak > 0 ? "accent" : "neutral"}
        />
        <StatTile
          label="Practice accuracy"
          /* Withheld below the evidence threshold rather than printed from a
             handful of answers — the same rule MasteryBar applies. */
          value={
            accuracy !== null && data.answered >= LOW_EVIDENCE_QUESTIONS
              ? `${Math.round(accuracy * 100)}%`
              : "—"
          }
          hint={
            data.answered >= LOW_EVIDENCE_QUESTIONS
              ? `${data.correct} of ${data.answered} questions`
              : `${data.answered} of ${LOW_EVIDENCE_QUESTIONS} answers needed`
          }
          Icon={ListChecks}
        />
        <StatTile
          label="Card recall"
          value={recall !== null ? `${Math.round(recall * 100)}%` : "—"}
          hint={
            data.cardsSeen > 0
              ? `${data.cardsKnown} of ${data.cardsSeen} cards`
              : "No cards reviewed yet"
          }
          Icon={Layers}
        />
      </div>

      <section className="flex flex-col gap-3">
        <SectionLabel>Last two weeks</SectionLabel>
        <Card>
          <CardBody className="py-5">
            <ActivityChart days={data.activity} />
          </CardBody>
        </Card>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:items-start">
        <section className="flex flex-col gap-3">
          <SectionLabel>By subject</SectionLabel>
          <Card>
            <CardBody className="p-0">
              <ul className="divide-y divide-rule">
                {data.subjects.map((subject) => {
                  const tone = SUBJECT_TONE[subject.colorSlot];
                  const subjectAccuracy =
                    subject.answered >= LOW_EVIDENCE_QUESTIONS
                      ? Math.round((subject.correct / subject.answered) * 100)
                      : null;
                  const subjectRecall =
                    subject.cardsSeen > 0
                      ? Math.round((subject.cardsKnown / subject.cardsSeen) * 100)
                      : null;

                  return (
                    <li key={subject.id} className="flex items-center gap-3 px-5 py-3.5">
                      <span className={cn("size-2 shrink-0 rounded-full", tone.dot)} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <Link
                          href={`/subjects/${subject.id}`}
                          className="block truncate font-medium transition-colors hover:text-accent"
                        >
                          {subject.name}
                        </Link>
                        <span className="mt-0.5 block text-xs text-ink-subtle">
                          {formatMinutes(subject.minutes)} · {subject.sessions}{" "}
                          {subject.sessions === 1 ? "session" : "sessions"}
                        </span>
                      </span>

                      {/* Two figures, labelled, never combined. */}
                      <span className="flex shrink-0 gap-4 text-right">
                        <span className="w-14">
                          <span className="block text-sm font-medium tabular-nums">
                            {subjectAccuracy !== null ? `${subjectAccuracy}%` : "—"}
                          </span>
                          <span className="block text-[0.6875rem] text-ink-subtle">answers</span>
                        </span>
                        <span className="w-14">
                          <span className="block text-sm font-medium tabular-nums">
                            {subjectRecall !== null ? `${subjectRecall}%` : "—"}
                          </span>
                          <span className="block text-[0.6875rem] text-ink-subtle">recall</span>
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </CardBody>
          </Card>
        </section>

        <section className="flex flex-col gap-3">
          <SectionLabel>Topic mastery</SectionLabel>
          <Card>
            <CardHeader>
              <CardTitle>Weakest first</CardTitle>
            </CardHeader>
            <CardBody className="flex flex-col gap-4 py-4">
              {weakest.length === 0 ? (
                /* The honest empty state, and it explains the two reasons it
                   can be empty — neither of which is "you know nothing". */
                <p className="flex items-start gap-2.5 text-sm leading-relaxed text-ink-muted">
                  <Brain className="mt-0.5 size-4 shrink-0 text-ink-subtle" aria-hidden />
                  {data.topics.length === 0
                    ? "Mastery is measured per topic, and only practice sets built from a reviewer scoped to ONE topic can measure it. Generate a reviewer for a topic rather than a whole subject, then practise it."
                    : `Not enough answers yet. A topic needs ${LOW_EVIDENCE_QUESTIONS} before a figure means anything, and showing one sooner would be guessing.`}
                </p>
              ) : (
                weakest.map((topic) => (
                  <MasteryBar
                    key={topic.id}
                    value={topic.mastery}
                    questionCount={topic.answered}
                    label={`${topic.topic} · ${topic.subject}`}
                  />
                ))
              )}
            </CardBody>
          </Card>
        </section>
      </div>

      <section className="flex flex-col gap-3">
        <SectionLabel>Recent sessions</SectionLabel>
        <Card>
          <CardBody className="p-0">
            <ul className="divide-y divide-rule">
              {data.recent.map((session) => (
                <SessionRow key={session.id} session={session} />
              ))}
            </ul>
          </CardBody>
        </Card>
      </section>
    </div>
  );
}

/**
 * Two weeks of studying, as bars.
 *
 * Scaled to the student's own busiest day rather than to a fixed ceiling: a
 * chart where every bar is a sliver because someone once studied for two hours
 * tells them nothing about this week.
 */
function ActivityChart({ days }: { days: ActivityDay[] }) {
  const peak = Math.max(...days.map((day) => day.minutes), 1);

  return (
    <div
      className="flex items-end gap-1.5 sm:gap-2"
      role="img"
      aria-label="Minutes studied per day"
    >
      {days.map((day) => (
        <div key={day.date} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
          <span className="text-[0.625rem] text-ink-subtle tabular-nums">
            {day.minutes > 0 ? day.minutes : ""}
          </span>
          <span
            /* A floor of 2px on a day with nothing, so the row reads as a
               timeline with gaps rather than as a chart that stops. */
            className={cn(
              "w-full rounded-t-[0.25rem] transition-[height]",
              day.minutes > 0 ? "bg-accent" : "bg-surface-sunken",
            )}
            style={{ height: `${Math.max(2, (day.minutes / peak) * 88)}px` }}
            title={`${day.minutes} min · ${day.sessions} ${day.sessions === 1 ? "session" : "sessions"}`}
          />
          <span className="truncate text-[0.625rem] text-ink-subtle">{day.label}</span>
        </div>
      ))}
    </div>
  );
}

const ACTIVITY_LABEL: Record<string, string> = {
  flashcards: "Flashcards",
  practice: "Practice",
  quiz: "Quiz",
  review: "Review",
  reading: "Reading",
};

function SessionRow({ session }: { session: RecentSession }) {
  const tone = SUBJECT_TONE[session.colorSlot];
  const scored = session.total !== null && session.total > 0;

  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-control)]",
          tone.tint,
          tone.ink,
        )}
      >
        {session.activity === "flashcards" ? (
          <Layers className="size-4" aria-hidden />
        ) : session.activity === "practice" || session.activity === "quiz" ? (
          <ListChecks className="size-4" aria-hidden />
        ) : (
          <CalendarCheck className="size-4" aria-hidden />
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.9375rem] font-medium">
          {ACTIVITY_LABEL[session.activity] ?? session.activity}
          {session.topic ? ` · ${session.topic}` : ""}
        </span>
        <span className="mt-0.5 block truncate text-xs text-ink-subtle">
          {session.subject} · {formatWhen(session.startedAt)}
        </span>
      </span>

      <span className="shrink-0 text-right">
        <span className="block text-sm font-medium tabular-nums">
          {scored ? `${session.correct}/${session.total}` : "—"}
        </span>
        <span className="block text-[0.6875rem] text-ink-subtle tabular-nums">
          {session.minutes} min
        </span>
      </span>
    </li>
  );
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function formatWhen(iso: string): string {
  const then = new Date(iso);
  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000);
  if (days === 0)
    return `today, ${then.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return then.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
