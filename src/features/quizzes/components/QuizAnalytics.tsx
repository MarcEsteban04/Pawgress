import { ChevronRight, Hash, Sigma, Star, Timer } from "lucide-react";
import Link from "next/link";
import { ScoreChart, SectionLabel, StatTile } from "@/components/ui";
import { percent, summariseAttempts } from "@/features/quizzes/analytics";
import { type AttemptRecord } from "@/server/quizzes/queries";

/**
 * How this quiz has gone, attempt by attempt (FR-P3, US-H2, Sprint 55).
 *
 * **Shown on the start screen, and only there.** It is what a student wants to
 * see when deciding whether to sit a paper again — "I got 62% last time" — and
 * exactly what they do not want in the corner of their eye while answering
 * question fourteen. `QuizStage` stops rendering it the moment Start is pressed.
 *
 * **Four numbers, each answering a different question.** Attempts: how much
 * evidence is there. Average: where do I usually land. Best: what have I shown
 * I can do. Recent: where am I now — which is the one that matters most, so it
 * carries the change since the attempt before.
 */
export function QuizAnalytics({ quizId, attempts }: { quizId: string; attempts: AttemptRecord[] }) {
  const summary = summariseAttempts(attempts);
  if (summary.attempts === 0) return null;

  const newestFirst = [...attempts].reverse();

  return (
    <section className="flex w-full flex-col gap-4">
      <SectionLabel>Your attempts</SectionLabel>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Attempts"
          value={summary.attempts}
          Icon={Hash}
          hint={summary.attempts === 1 ? "Sit it again to see a trend" : undefined}
        />
        <StatTile
          label="Average"
          value={percent(summary.average)}
          Icon={Sigma}
          /* Named, because it is the one people read as something it is not.
             With one attempt the average IS that attempt, and saying so stops
             it looking like a second, independent fact. */
          hint={summary.attempts === 1 ? "From one attempt" : `Across ${summary.attempts}`}
        />
        <StatTile
          label="Best"
          value={percent(summary.best?.share)}
          Icon={Star}
          hint={summary.best ? formatDate(summary.best.submittedAt) : undefined}
        />
        <StatTile
          label="Most recent"
          value={percent(summary.recent?.share)}
          Icon={Timer}
          tone="accent"
          hint={changeHint(summary.change)}
        />
      </div>

      {/* A line needs two points. With one, a chart is a dot in an empty box
          that looks like something failed to load. */}
      {summary.attempts >= 2 && (
        <div className="rounded-[var(--radius-card)] border border-rule bg-surface p-4 shadow-[var(--shadow-card)]">
          <ScoreChart
            data={attempts.map((attempt, index) => ({
              label: `#${index + 1}`,
              value: attempt.total > 0 ? attempt.correct / attempt.total : 0,
            }))}
            emptyMessage="No scored attempts yet."
          />
        </div>
      )}

      <ol className="flex flex-col divide-y divide-rule overflow-hidden rounded-[var(--radius-card)] border border-rule bg-surface">
        {newestFirst.map((attempt) => {
          const number = attempts.indexOf(attempt) + 1;
          const isBest = summary.best?.id === attempt.id && summary.attempts > 1;

          return (
            <li key={attempt.id}>
              <Link
                href={`/quizzes/${quizId}/attempts/${attempt.id}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-sunken"
              >
                <span className="w-8 shrink-0 text-xs text-ink-subtle tabular-nums">#{number}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm">{formatDate(attempt.submittedAt)}</span>
                  {attempt.durationSeconds ? (
                    <span className="block text-xs text-ink-subtle tabular-nums">
                      {formatDuration(attempt.durationSeconds)}
                    </span>
                  ) : null}
                </span>
                {isBest && (
                  <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-accent-soft px-2 py-0.5 text-[0.6875rem] font-medium text-accent">
                    <Star className="size-3" aria-hidden />
                    Best
                  </span>
                )}
                <span className="text-right tabular-nums">
                  <span className="block text-sm font-medium">
                    {attempt.correct}/{attempt.total}
                  </span>
                  <span className="block text-xs text-ink-subtle">
                    {percent(attempt.total > 0 ? attempt.correct / attempt.total : 0)}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-ink-subtle" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/**
 * The change since last time, in words.
 *
 * Under five points is "about the same". On a twenty-question quiz that is one
 * question, and calling one question a trend is the overconfidence every
 * number on this screen is trying to avoid.
 */
function changeHint(change: number | null): string | undefined {
  if (change === null) return undefined;
  if (Math.abs(change) < 5) return "About the same as last time";
  return change > 0 ? `Up ${change} points on last time` : `Down ${-change} points on last time`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
}
