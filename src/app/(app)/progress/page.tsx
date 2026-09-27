import {
  CalendarCheck,
  ChevronRight,
  ClipboardCheck,
  Flame,
  Gauge,
  Layers,
  ListChecks,
  Shuffle,
  Sigma,
  Target,
  Timer,
} from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Card,
  CardBody,
  EmptyState,
  MasteryBar,
  ScoreChart,
  SectionLabel,
  StatTile,
  buttonStyles,
} from "@/components/ui";
import { TopicMasteryPanel } from "@/features/mastery/components/TopicMasteryPanel";
import { percent } from "@/features/quizzes/analytics";
import { SUBJECT_TONE } from "@/features/subjects/components/SubjectIcon";
import {
  LOW_EVIDENCE_QUESTIONS,
  getProgressOverview,
  type ActivityDay,
  type ProgressOverview,
  type RecentSession,
  type TopicMastery,
} from "@/server/progress/queries";
import { cn } from "@/lib/utils";

/**
 * Progress (FR-P1–P3, US-H1, Sprint 58).
 *
 * **Five questions, top to bottom, in the order a student asks them.** How am I
 * doing overall; how much have I been studying; how are my quizzes going; which
 * subject; which topic. Then the log, for anyone who wants the detail behind
 * the rest. Each section answers one question and does not wander into the
 * next — a page of every number at once is a page nobody reads.
 *
 * **Two kinds of number, never mixed.** Time, sessions and streaks are
 * COUNTED. Mastery is MODELLED, by the Sprint 56 formula over the answers
 * themselves. Card recall sits with study time rather than with mastery,
 * because pressing "I had it" is a student's own judgement, and folding it into
 * a percentage built from marked answers would make that percentage partly
 * self-reported.
 *
 * **Nothing is shown as a percentage below ten answered questions.**
 * `MasteryBar` enforces that, and so does every tile here — a figure from three
 * answers is noise dressed as measurement.
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
          description="Every quiz, practice set and flashcard deck you finish lands here."
        />
        <EmptyState
          Icon={Target}
          title="Nothing measured yet"
          description="Take a quiz, or finish a practice set or a flashcard deck, and it shows up here — how long you studied, how your quizzes are going, and which topics are holding you back. Nothing is recorded until you finish, so a half-done run costs you nothing."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link href="/quizzes" className={buttonStyles({ variant: "accent" })}>
                Take a quiz
              </Link>
              <Link href="/reviewers" className={buttonStyles({ variant: "subtle" })}>
                Go to your reviewers
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="What you know, and what you do not yet"
        title="Progress"
        description="Time and streaks are counted. Mastery is worked out from the questions you answer."
      />

      <Overview data={data} />

      <section className="flex flex-col gap-3">
        <SectionLabel>Study time</SectionLabel>
        <StudyTime data={data} />
      </section>

      <section className="flex flex-col gap-3">
        <SectionLabel>Quiz performance</SectionLabel>
        <QuizPerformance quizzes={data.quizzes} />
      </section>

      <section className="flex flex-col gap-3">
        <SectionLabel>By subject</SectionLabel>
        <Subjects subjects={data.subjects} />
      </section>

      <section className="flex flex-col gap-3">
        <SectionLabel>By topic</SectionLabel>
        <TopicMasteryPanel topics={data.topics} />
        <EveryTopic topics={data.topics} />
      </section>

      <section className="flex flex-col gap-3">
        <SectionLabel>Recent sessions</SectionLabel>
        <Card className="overflow-hidden">
          <CardBody flush>
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

/* ------------------------------------------------------------ overall */

/**
 * The four headline numbers.
 *
 * **Overall mastery leads**, because it is the question a student opens this
 * page with. It says how much of the syllabus stands behind it — "4 of 11
 * topics measured" — since 72% across four topics and 72% across eleven are
 * not the same claim, and the tile should not let them look alike.
 */
function Overview({ data }: { data: ProgressOverview }) {
  const overall = data.overall.mastery;
  const measured = overall !== null && overall.questions >= LOW_EVIDENCE_QUESTIONS;
  const weekChange = data.week.recent - data.week.before;

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <StatTile
        label="Overall mastery"
        value={measured ? percent(overall.mastery) : "—"}
        Icon={Gauge}
        tone="accent"
        hint={
          measured
            ? data.overall.topicCount > 0
              ? `${data.overall.measuredTopics} of ${data.overall.topicCount} topics measured`
              : `From ${overall.questions} questions`
            : `${overall?.questions ?? 0} of ${LOW_EVIDENCE_QUESTIONS} answers needed`
        }
      />
      <StatTile
        label="Last 7 days"
        value={formatMinutes(data.week.recent)}
        Icon={Timer}
        hint={
          data.week.before === 0 && data.week.recent === 0
            ? "Nothing yet this week"
            : data.week.before === 0
              ? "Nothing the week before"
              : weekChange === 0
                ? "Same as the week before"
                : `${weekChange > 0 ? "+" : "−"}${formatMinutes(Math.abs(weekChange))} on the week before`
        }
      />
      <StatTile
        label="Day streak"
        value={data.streak}
        Icon={Flame}
        /* Said plainly, because a streak that looks like it might already be
           lost is a streak someone stops trying to keep. */
        hint={data.streak > 0 ? "Study today to keep it" : "Finish something to start one"}
      />
      <StatTile
        label="Quiz average"
        value={percent(data.quizzes.average)}
        Icon={Sigma}
        href="/quizzes"
        hint={
          data.quizzes.attempts > 0
            ? `${data.quizzes.attempts} ${data.quizzes.attempts === 1 ? "attempt" : "attempts"} · best ${percent(data.quizzes.best?.share)}`
            : "No quizzes taken yet"
        }
      />
    </div>
  );
}

/* --------------------------------------------------------- study time */

function StudyTime({ data }: { data: ProgressOverview }) {
  const recall = data.cardsSeen > 0 ? data.cardsKnown / data.cardsSeen : null;

  return (
    <Card>
      <CardBody className="flex flex-col gap-5 py-5">
        <ActivityChart days={data.activity} />

        {/* The lifetime facts, as a line under the chart rather than as more
            tiles: they are context for the chart, not headlines of their own. */}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-rule pt-4 text-sm sm:grid-cols-4">
          <Fact label="All time" value={formatMinutes(data.totalMinutes)} />
          <Fact label="Sessions" value={String(data.totalSessions)} />
          <Fact
            label="Card recall"
            value={recall !== null ? percent(recall) : "—"}
            hint={
              data.cardsSeen > 0
                ? `${data.cardsKnown} of ${data.cardsSeen}, self-marked`
                : "No cards reviewed yet"
            }
          />
          <Fact label="Last 14 days" value={formatMinutes(sum(data.activity))} />
        </dl>
      </CardBody>
    </Card>
  );
}

function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-subtle">{label}</dt>
      <dd className="mt-0.5 font-medium tabular-nums">{value}</dd>
      {hint && <dd className="text-xs text-ink-subtle">{hint}</dd>}
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

/* --------------------------------------------------- quiz performance */

/**
 * Quizzes and mock exams — never practice.
 *
 * Practice is marked question by question and taken to learn; averaging first
 * passes into this would drag a measurement down with attempts that were never
 * meant as one. The average is pooled — every question over every question —
 * for the reason `summariseAttempts` sets out.
 */
function QuizPerformance({ quizzes }: { quizzes: ProgressOverview["quizzes"] }) {
  if (quizzes.attempts === 0) {
    return (
      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-3 py-5">
          <p className="flex items-center gap-2.5 text-sm text-ink-muted">
            <ClipboardCheck className="size-4 shrink-0 text-ink-subtle" aria-hidden />
            No quizzes taken yet. A quiz is the one measurement here nobody marked themselves.
          </p>
          <Link href="/quizzes" className={buttonStyles({ variant: "subtle", size: "sm" })}>
            Make a quiz
          </Link>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody className="flex flex-col gap-5 py-5 lg:flex-row lg:items-stretch">
        <dl className="grid shrink-0 grid-cols-2 gap-x-6 gap-y-4 lg:w-60 lg:grid-cols-1">
          <Fact
            label="Average"
            value={percent(quizzes.average)}
            hint={`Across ${quizzes.distinct} ${quizzes.distinct === 1 ? "quiz" : "quizzes"}`}
          />
          <Fact label="Best" value={percent(quizzes.best?.share)} />
          <Fact
            label="Most recent"
            value={percent(quizzes.recent?.share)}
            hint={changeLine(quizzes.change)}
          />
          <Fact label="Attempts" value={String(quizzes.attempts)} />
        </dl>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {/* A line needs two points. With one it is a dot in an empty box that
              looks like something failed to load. */}
          {quizzes.trend.length >= 2 ? (
            <ScoreChart data={quizzes.trend} emptyMessage="No scored attempts yet." />
          ) : (
            <p className="flex flex-1 items-center justify-center rounded-[var(--radius-control)] border border-dashed border-rule-strong px-4 py-8 text-center text-sm text-ink-muted">
              Take another quiz to see a trend.
            </p>
          )}
          <Link
            href="/quizzes"
            className="inline-flex items-center gap-1 self-end text-xs font-medium text-ink-muted transition-colors hover:text-ink"
          >
            Every quiz
            <ChevronRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}

function changeLine(change: number | null): string | undefined {
  if (change === null) return undefined;
  /* Under five points is one question in twenty: the same score. */
  if (Math.abs(change) < 5) return "About the same as last time";
  return change > 0 ? `Up ${change} points on last time` : `Down ${-change} points on last time`;
}

/* ------------------------------------------------------------ subjects */

/**
 * One row per subject: its mastery, how much of it is measured, and the time
 * behind it.
 *
 * Mastery rather than raw accuracy. This column used to be the share of
 * session answers that were right — a different number from the one the rest
 * of the product calls mastery, so a subject could read 80% here and 64% on
 * its own page. It is the Sprint 56 figure now, the same one everywhere.
 */
function Subjects({ subjects }: { subjects: ProgressOverview["subjects"] }) {
  return (
    <Card className="overflow-hidden">
      <CardBody flush>
        <ul className="divide-y divide-rule">
          {subjects.map((subject) => {
            const tone = SUBJECT_TONE[subject.colorSlot];

            return (
              <li key={subject.id}>
                <Link
                  href={`/subjects/${subject.id}`}
                  className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-surface-sunken sm:flex-row sm:items-center sm:gap-6"
                >
                  <span className="flex min-w-0 items-center gap-3 sm:w-64 sm:shrink-0">
                    <span className={cn("size-2 shrink-0 rounded-full", tone.dot)} aria-hidden />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{subject.name}</span>
                      <span className="mt-0.5 block text-xs text-ink-subtle">
                        {formatMinutes(subject.minutes)} · {subject.sessions}{" "}
                        {subject.sessions === 1 ? "session" : "sessions"}
                      </span>
                    </span>
                  </span>

                  <span className="min-w-0 flex-1">
                    <MasteryBar
                      value={subject.mastery?.mastery ?? 0}
                      questionCount={subject.mastery?.questions ?? 0}
                      label="Mastery"
                      dense
                    />
                  </span>

                  <span className="shrink-0 text-xs text-ink-subtle tabular-nums sm:w-32 sm:text-right">
                    {subject.topicCount > 0
                      ? `${subject.measuredTopics} of ${subject.topicCount} topics measured`
                      : "No topics yet"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </CardBody>
    </Card>
  );
}

/* -------------------------------------------------------------- topics */

/**
 * Every topic with any answers, grouped by subject.
 *
 * The weak and strong lists above answer "where do I start" and "what can I
 * leave"; this answers "and everything in between", which those lists
 * deliberately leave out. Collapsed by default: it is the longest thing on the
 * page and the one fewest people need on a given visit.
 */
function EveryTopic({ topics }: { topics: TopicMastery[] }) {
  if (topics.length === 0) return null;

  const bySubject = new Map<string, TopicMastery[]>();
  for (const topic of topics) {
    const list = bySubject.get(topic.subject);
    if (list) list.push(topic);
    else bySubject.set(topic.subject, [topic]);
  }

  return (
    <details className="group rounded-[var(--radius-card)] border border-rule bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-medium transition-colors hover:bg-surface-sunken">
        <span>Every topic ({topics.length})</span>
        <ChevronRight
          className="size-4 text-ink-subtle transition-transform group-open:rotate-90"
          aria-hidden
        />
      </summary>

      <div className="flex flex-col gap-6 border-t border-rule px-5 py-5">
        {[...bySubject.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([subject, list]) => (
            <div key={subject} className="flex flex-col gap-3">
              <p className="text-xs font-semibold tracking-[0.08em] text-ink-subtle uppercase">
                {subject}
              </p>
              {/* Weakest first within each subject, the order a student would
                  work through them in. */}
              {[...list]
                .sort((a, b) => a.mastery - b.mastery)
                .map((topic) => (
                  <MasteryBar
                    key={topic.id}
                    value={topic.mastery}
                    questionCount={topic.answered}
                    label={topic.topic}
                    dense
                  />
                ))}
            </div>
          ))}
      </div>
    </details>
  );
}

/* ---------------------------------------------------------------- log */

const ACTIVITY_LABEL: Record<string, string> = {
  flashcards: "Flashcards",
  practice: "Practice",
  quiz: "Quiz",
  matching: "Matching",
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
        ) : session.activity === "matching" ? (
          <Shuffle className="size-4" aria-hidden />
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

function sum(days: ActivityDay[]): number {
  return days.reduce((total, day) => total + day.minutes, 0);
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
