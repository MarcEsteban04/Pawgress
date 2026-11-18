import { CalendarClock, TriangleAlert } from "lucide-react";
import { CONSISTENT_DAYS, READINESS_WINDOW_DAYS, shareLabel } from "@/features/readiness/score";
import { type SubjectReadiness } from "@/server/readiness/queries";
import { LOW_EVIDENCE_QUESTIONS } from "@/types";
import { cn } from "@/lib/utils";

/**
 * What a readiness score is made of (FR-D2, US-J3 "readiness shows the inputs
 * behind the number", Sprint 71).
 *
 * One component for the dashboard and the subject hub, so the two explain the
 * same number the same way. Each line is an input, what it measured, and the
 * share of the score it carries; an input with nothing to measure says so and
 * says where its share went, rather than quietly counting as zero.
 *
 * Text in ink — the figures are words a student reads, not marks on a chart,
 * and none of them is a verdict in red (docs/branding.md: mastery is never red).
 */

const URGENCY_WORD = {
  critical: "start now",
  soon: "time to revise",
  ahead: "on track",
  overdue: "overdue",
  done: "done",
} as const;

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function countdown(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

export function ReadinessBreakdown({
  data,
  className,
}: {
  data: SubjectReadiness;
  className?: string;
}) {
  const { inputs, readiness } = data;
  const part = (key: string) => readiness?.parts.find((p) => p.key === key);

  const lines: { label: string; value: string; detail: string }[] = [];

  if (readiness) {
    lines.push({
      label: "Mastery",
      value: percent(inputs.mastery!),
      detail: `from ${inputs.answered} answers · ${shareLabel(part("mastery")!.weight)}`,
    });

    const coverage = part("coverage")!;
    lines.push({
      label: "Topics measured",
      value: coverage.value === null ? "—" : `${inputs.measuredTopics} of ${inputs.topics}`,
      detail:
        coverage.value === null
          ? "no topics yet — its share goes to the others"
          : `enough answers to count · ${shareLabel(coverage.weight)}`,
    });

    const recent = part("recent")!;
    lines.push({
      label: `Last ${READINESS_WINDOW_DAYS / 7} weeks`,
      value: recent.value === null ? "—" : percent(recent.value),
      detail:
        recent.value === null
          ? "no quizzes or practice — its share goes to the others"
          : `${inputs.recent!.correct} of ${inputs.recent!.total} right in ${inputs.recent!.runs} ${
              inputs.recent!.runs === 1 ? "set" : "sets"
            } · ${shareLabel(recent.weight)}`,
    });

    lines.push({
      label: "Days studied",
      value: `${inputs.studyDays} of ${READINESS_WINDOW_DAYS}`,
      detail: `${CONSISTENT_DAYS}+ is full marks · ${shareLabel(part("consistency")!.weight)}`,
    });
  }

  return (
    <div className={cn("flex flex-col gap-3 text-sm", className)}>
      {readiness ? (
        <dl className="grid grid-cols-[auto_auto_1fr] items-baseline gap-x-3 gap-y-1.5">
          {lines.map((line) => (
            <div key={line.label} className="contents">
              <dt className="text-ink-muted">{line.label}</dt>
              <dd className="font-medium tabular-nums">{line.value}</dd>
              <dd className="text-xs text-ink-subtle">{line.detail}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-ink-muted">
          Not scored yet — {inputs.answered} of {LOW_EVIDENCE_QUESTIONS} answered questions needed
          in this subject. A readiness figure from fewer would be a guess.
        </p>
      )}

      {/* Beside the score, not inside it: see `features/readiness/score.ts`. */}
      {(data.weakTopics > 0 || data.nextExam) && (
        <ul className="flex flex-col gap-1 text-xs text-ink-muted">
          {data.weakTopics > 0 && (
            <li className="flex items-center gap-1.5">
              <TriangleAlert className="size-3.5 text-ink-subtle" aria-hidden />
              {data.weakTopics} weak {data.weakTopics === 1 ? "topic" : "topics"} — already counted
              in mastery
            </li>
          )}
          {data.nextExam && (
            <li className="flex items-center gap-1.5">
              <CalendarClock className="size-3.5 text-ink-subtle" aria-hidden />
              {data.nextExam.title} {countdown(data.nextExam.daysAway)} —{" "}
              {URGENCY_WORD[data.nextExam.band]}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
