import { ClipboardCheck, Clock, FileText, TriangleAlert } from "lucide-react";
import { notFound } from "next/navigation";
import { Card, CardBody } from "@/components/ui";
import { GeneratingOverlay, Ghost } from "@/features/jobs/components/GeneratingOverlay";
import { ProgressWatcher } from "@/features/jobs/components/ProgressWatcher";
import { DIFFICULTY_LABELS, estimateMinutes } from "@/features/quizzes/schema";
import { StudyShell } from "@/features/reviewers/components/StudyShell";
import { getQuiz } from "@/server/quizzes/queries";

/**
 * One quiz (FR-Q1, US-G1, Sprint 49).
 *
 * **Creation is this sprint; taking it is the next one.** A ready quiz shows
 * what was written and what it covers, and says plainly that the question
 * screen is not built yet. A page that hid the distinction — a Start button
 * that did nothing, or a quiz that silently never opened — would be worse than
 * one sentence of honesty.
 *
 * It reuses `StudyShell` because it IS a study screen: same full-width frame,
 * same subject colour, same back-to-the-library bar as a reviewer or a deck.
 */

export async function generateMetadata({ params }: PageProps<"/quizzes/[quizId]">) {
  const { quizId } = await params;
  const quiz = await getQuiz(quizId);
  return { title: quiz?.title ?? "Quiz" };
}

export default async function Page({ params }: PageProps<"/quizzes/[quizId]">) {
  const { quizId } = await params;
  const quiz = await getQuiz(quizId);

  if (!quiz) notFound();

  const working = quiz.status !== "ready" && quiz.status !== "failed";

  return (
    <StudyShell
      backHref="/quizzes"
      backLabel="your quizzes"
      eyebrow={[quiz.subjectName, quiz.topicName].filter(Boolean).join(" · ") || "Quiz"}
      title={quiz.title}
      colorSlot={quiz.colorSlot}
    >
      {/* Nudges the queue and refreshes while it is being written, so a lost
          kick recovers instead of leaving the quiz at `queued` for ever. */}
      <ProgressWatcher active={working} />

      {working ? (
        <GeneratingOverlay
          title="Aki is writing your quiz"
          detail={`Reading your material and writing ${quiz.questionCount} ${DIFFICULTY_LABELS[quiz.difficulty]?.label.toLowerCase()} questions. Usually under a minute.`}
          skeleton={<QuizSkeleton />}
        />
      ) : quiz.status === "failed" ? (
        <Card>
          <CardBody className="flex items-start gap-3 py-5">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden />
            <p className="text-sm leading-relaxed">
              {quiz.failureMessage ?? "This quiz could not be written."} Your files are untouched —
              nothing was lost.
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="mx-auto flex w-full max-w-[42rem] flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Fact
              Icon={ClipboardCheck}
              label="Questions"
              value={String(quiz.questionCount)}
              /* Said only when it matters. A student who asked for twenty and
                 got seventeen deserves to know the material ran out rather
                 than wondering whether we lost three. */
              hint="Written from your files"
            />
            <Fact
              Icon={Clock}
              label="Takes about"
              value={`${estimateMinutes(quiz.questionCount)} min`}
              hint="Untimed"
            />
            <Fact
              Icon={FileText}
              label="Difficulty"
              value={DIFFICULTY_LABELS[quiz.difficulty]?.label ?? quiz.difficulty}
              hint={DIFFICULTY_LABELS[quiz.difficulty]?.blurb}
            />
          </div>

          {/* The honest note, not a dead button. */}
          <Card>
            <CardBody className="flex items-start gap-3 py-5">
              <ClipboardCheck className="mt-0.5 size-4 shrink-0 text-ink-subtle" aria-hidden />
              <p className="text-sm leading-relaxed text-ink-muted">
                Your questions are written and saved. The screen for actually sitting a quiz — one
                question at a time, with a progress bar and a score at the end — is the next thing
                being built. Until then, practice questions on a reviewer work today.
              </p>
            </CardBody>
          </Card>
        </div>
      )}
    </StudyShell>
  );
}

function Fact({
  Icon,
  label,
  value,
  hint,
}: {
  Icon: typeof ClipboardCheck;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-rule bg-surface p-4 shadow-[var(--shadow-card)]">
      <p className="flex items-center gap-1.5 text-xs tracking-[0.06em] text-ink-subtle uppercase">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </p>
      <p className="mt-2 font-display text-xl font-semibold tracking-[-0.01em] tabular-nums">
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs leading-snug text-ink-subtle">{hint}</p>}
    </div>
  );
}

/** The shape of a quiz summary, before there is one. */
function QuizSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[42rem] flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rise flex flex-col gap-2 rounded-[var(--radius-card)] border border-rule bg-surface p-4 shadow-[var(--shadow-card)]"
            style={{ animationDelay: `${i * 90}ms` }}
          >
            <Ghost className="h-2.5 w-20" delay={i * 90} />
            <Ghost className="h-5 w-16" delay={40 + i * 90} />
          </div>
        ))}
      </div>
      <div className="rise rounded-[var(--radius-card)] border border-rule bg-surface p-5 shadow-[var(--shadow-card)]">
        <Ghost className="h-3.5 w-full" delay={300} />
        <Ghost className="mt-2 h-3.5 w-[80%]" delay={350} />
      </div>
    </div>
  );
}
