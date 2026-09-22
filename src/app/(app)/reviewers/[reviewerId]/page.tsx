import { ArrowRight, Layers, ListChecks, Shuffle, Target, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { type ReactNode } from "react";
import { Card, CardBody, StatusBadge } from "@/components/ui";
import { GenerateFlashcardsButton } from "@/features/flashcards/components/GenerateFlashcardsButton";
import { GeneratingOverlay, Ghost } from "@/features/jobs/components/GeneratingOverlay";
import { ProgressWatcher } from "@/features/jobs/components/ProgressWatcher";
import { GenerateQuestionsButton } from "@/features/practice/components/GenerateQuestionsButton";
import { ReviewerDocumentView } from "@/features/reviewers/components/ReviewerDocumentView";
import { ReviewerTitle } from "@/features/reviewers/components/ReviewerTitle";
import { StudyShell } from "@/features/reviewers/components/StudyShell";
import { MATCH_MINIMUM, matchPairs } from "@/features/reviewers/matching";
import { SUBJECT_TONE } from "@/features/subjects/components/SubjectIcon";
import { countFlashcards } from "@/server/flashcards/queries";
import { countMissedQuestions, countPracticeQuestions } from "@/server/practice/queries";
import { getReviewer } from "@/server/reviewers/queries";
import { cn } from "@/lib/utils";

/**
 * One generated reviewer (FR-R1, US-F1).
 *
 * **Its own route, not a page inside a subject.** A reviewer is what a student
 * revises FROM, and it is the hub the flashcards and the practice set hang off
 * — nesting it under /subjects/[id] made opening one from the library feel like
 * being sent back to a class you had already left.
 *
 * **Two columns on a wide screen: the document, and what to do with it.** The
 * page was one 52rem column with the study buttons squeezed into a row under
 * the title, where they read as page furniture rather than as the point. Prose
 * keeps a readable measure — a 1900px-wide paragraph is unreadable, and "full
 * width" is not an instruction to stretch text — and the width that is left
 * goes to a rail that stays put while the document scrolls.
 *
 * **Four sections in a fixed order, because the order is the advice.** Summary
 * first for the student with two minutes; then what to revise first, because
 * knowing where to start is worth more than any single explanation; then the
 * concepts; then the terms.
 */

export async function generateMetadata({ params }: PageProps<"/reviewers/[reviewerId]">) {
  const { reviewerId } = await params;
  const reviewer = await getReviewer(reviewerId);
  return { title: reviewer?.title ?? "Reviewer" };
}

export default async function Page({ params }: PageProps<"/reviewers/[reviewerId]">) {
  const { reviewerId } = await params;
  const [reviewer, cardCount, questionCount, missedCount] = await Promise.all([
    getReviewer(reviewerId),
    countFlashcards(reviewerId),
    countPracticeQuestions(reviewerId),
    countMissedQuestions(reviewerId),
  ]);

  if (!reviewer) notFound();

  const id = reviewer.subjectId;
  const content = reviewer.content;
  const working = reviewer.status !== "ready" && reviewer.status !== "failed";
  /* Matching needs no generation — the pairs are the reviewer's own key terms.
     Counted here so the rail can leave the tile out rather than offer a board
     of two. */
  const pairCount = content ? matchPairs(content).length : 0;

  return (
    <StudyShell
      backHref="/reviewers"
      backLabel="your reviewers"
      /* Subject AND topic, because this is the only screen where "which part of
         the class is this" is not already answered by the surrounding list. */
      eyebrow={[reviewer.subjectName || "Reviewer", reviewer.topicName].filter(Boolean).join(" · ")}
      /* An element, not a string: the shell's `<h1>` becomes the renameable one,
         instead of the page printing its own title a second time underneath. */
      title={<ReviewerTitle reviewerId={reviewerId} title={reviewer.title} />}
      colorSlot={reviewer.colorSlot}
      actions={<StatusBadge status={reviewer.status} />}
    >
      {/* Only while it is actually generating. Nudges the queue and refreshes,
          so a finished reviewer appears without a manual reload — and a job
          whose single kick was lost gets picked up instead of sitting for
          ever. Renders nothing. */}
      <ProgressWatcher active={working} />

      {/* Still being written, and nothing to read yet. The overlay rather than
          a sentence in a card: this is the same wait as the deck and the
          question set, and it should not look like a different product. */}
      {working && !content && (
        <GeneratingOverlay
          title="Aki is reading your material"
          detail="Working through the files in this subject and writing a summary, the key concepts and terms, and what to revise first."
          skeleton={<DocumentSkeleton />}
        />
      )}

      {reviewer.status === "failed" && !content && (
        <Card>
          <CardBody className="flex items-start gap-3 py-5">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden />
            <p className="text-sm leading-relaxed">
              {reviewer.failureMessage ?? "This reviewer could not be generated."} Nothing was lost
              — your material is untouched.
            </p>
          </CardBody>
        </Card>
      )}

      {content && (
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:gap-8">
          {/* The prose column keeps a measure a person can read. Capped, and
              centred only until the rail appears beside it. */}
          <div className="mx-auto w-full max-w-[52rem] min-w-0 xl:mx-0 xl:flex-1">
            <ReviewerDocumentView
              reviewerId={reviewerId}
              document={content}
              sourceCount={reviewer.sourceCount}
            />
          </div>

          {/* The rail. Sticky, because the two things a student does with a
              reviewer should be reachable from anywhere in a long document
              rather than only from the top of it. Below it on narrow screens,
              where it comes FIRST — on a phone, "what do I do with this" beats
              scrolling the whole summary to find out. */}
          {reviewer.status === "ready" && (
            <aside className="-order-1 w-full shrink-0 xl:sticky xl:top-6 xl:order-none xl:w-[19rem]">
              <div className="flex flex-col gap-3">
                <p className="text-xs font-semibold tracking-[0.08em] text-ink-subtle uppercase">
                  Study this
                </p>

                <StudyTile
                  colorSlot={reviewer.colorSlot}
                  icon={<Layers className="size-[1.125rem]" aria-hidden />}
                  title="Flashcards"
                  blurb="One idea a card. Flip, then mark what stuck."
                  count={cardCount}
                  unit="card"
                  href={`/reviewers/${reviewerId}/flashcards`}
                  generate={
                    <GenerateFlashcardsButton subjectId={id} reviewerId={reviewerId} size="sm" />
                  }
                />

                <StudyTile
                  colorSlot={reviewer.colorSlot}
                  icon={<ListChecks className="size-[1.125rem]" aria-hidden />}
                  title="Practice questions"
                  blurb="Four kinds, each with an explanation. Finishing a set updates your progress."
                  count={questionCount}
                  unit="question"
                  href={`/reviewers/${reviewerId}/practice`}
                  generate={
                    <GenerateQuestionsButton subjectId={id} reviewerId={reviewerId} size="sm" />
                  }
                />

                {/* Shown from the moment there are questions to get wrong, not
                    from the moment some have been. Empty it explains what fills
                    it; full it is the way in. It empties itself again as they
                    are cleared, which is the good ending rather than a gap. */}
                {questionCount > 0 && (
                  <StudyTile
                    colorSlot={reviewer.colorSlot}
                    icon={<Target className="size-[1.125rem]" aria-hidden />}
                    title="Review mistakes"
                    blurb="Anything you miss in practice lands here, so you can go back and get it right without taking the whole set again."
                    count={missedCount}
                    unit="question"
                    note={`${missedCount} to get right`}
                    emptyNote={
                      missedCount === 0 && questionCount > 0
                        ? "Nothing missed yet — practise first."
                        : undefined
                    }
                    href={`/reviewers/${reviewerId}/review`}
                  />
                )}

                {/* Needs nothing generated, so it is offered the moment the
                    reviewer is. Below the minimum it says why rather than
                    vanishing — a missing tile reads as a missing feature. */}
                <StudyTile
                  colorSlot={reviewer.colorSlot}
                  icon={<Shuffle className="size-[1.125rem]" aria-hidden />}
                  title="Matching"
                  blurb="Pair each key term with its definition. Built from this reviewer, so there is nothing to generate and nothing to wait for."
                  count={pairCount >= MATCH_MINIMUM ? pairCount : 0}
                  unit="pair"
                  note={`${pairCount} pairs · nothing to generate`}
                  emptyNote={`Needs ${MATCH_MINIMUM} key terms; this one has ${pairCount}.`}
                  href={`/reviewers/${reviewerId}/matching`}
                />
              </div>
            </aside>
          )}
        </div>
      )}
    </StudyShell>
  );
}

/**
 * One thing a student can do with this reviewer.
 *
 * Two states in one tile, and the difference is the whole design: once it
 * exists, the tile IS the way in and says how much there is; before it does, it
 * explains what it would be and offers to make it. The alternative — a button
 * that becomes a link — loses the count, which is the fact that decides whether
 * someone opens it.
 */
function StudyTile({
  colorSlot,
  icon,
  title,
  blurb,
  count,
  unit,
  note,
  href,
  generate,
  emptyNote,
}: {
  colorSlot: 1 | 2 | 3 | 4 | 5;
  icon: ReactNode;
  title: string;
  /** Only needed by a tile that has an empty state to explain. */
  blurb?: string;
  count: number;
  unit: string;
  /** Replaces "N units ready" where that is the wrong sentence. */
  note?: string;
  href: string;
  /** The control that makes the thing, for the modes that are generated. */
  generate?: ReactNode;
  /**
   * What an empty tile says instead of offering a button.
   *
   * THE REASON THIS EXISTS. "Review mistakes" was hidden until it had something
   * in it, on the reasoning that a tile reading "0 mistakes" is furniture. What
   * that actually did was hide the feature from everyone who had not yet made a
   * mistake — which is everyone, the first time they look — so the one place it
   * could have been discovered showed no sign of it. A study mode nobody can
   * find is not a tidier rail; it is a missing feature.
   */
  emptyNote?: string;
}) {
  const tone = SUBJECT_TONE[colorSlot];

  if (count === 0 && !generate && !emptyNote) return null;

  if (count === 0) {
    return (
      <div className="flex flex-col gap-2.5 rounded-[var(--radius-card)] border border-dashed border-rule-strong bg-surface p-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-surface-sunken text-ink-subtle">
            {icon}
          </span>
          <p className="font-display font-semibold">{title}</p>
        </div>
        <p className="text-[0.8125rem] leading-relaxed text-ink-muted">{blurb}</p>
        {/* A button when there is something to press, and a plain line when
            there is not. Nothing here fills a mistakes list except practising,
            so offering a control would be offering the wrong one. */}
        {generate ? (
          <div className="mt-0.5">{generate}</div>
        ) : (
          emptyNote && <p className="text-[0.8125rem] font-medium text-ink-subtle">{emptyNote}</p>
        )}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-[var(--radius-card)] border border-rule bg-surface p-4 shadow-[var(--shadow-card)] transition-all hover:-translate-y-px hover:border-rule-strong hover:shadow-[var(--shadow-pop)]"
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-control)]",
          tone.tint,
          tone.ink,
        )}
      >
        {icon}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block font-display font-semibold">{title}</span>
        <span className="mt-0.5 block text-[0.8125rem] text-ink-subtle tabular-nums">
          {note ?? `${count} ${count === 1 ? unit : `${unit}s`} ready`}
        </span>
      </span>

      <ArrowRight
        className="size-4 shrink-0 text-ink-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-ink"
        aria-hidden
      />
    </Link>
  );
}

/** The shape of a reviewer, before there is one: summary, then sections. */
function DocumentSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[52rem] flex-1 flex-col gap-5">
      <div className="rise flex flex-col gap-2.5 rounded-[var(--radius-card)] border border-rule bg-surface px-5 py-5 shadow-[var(--shadow-card)]">
        <Ghost className="h-4 w-full" delay={60} />
        <Ghost className="h-4 w-[92%]" delay={110} />
        <Ghost className="h-4 w-[70%]" delay={160} />
      </div>

      <Ghost className="h-2.5 w-24" delay={220} />
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rise flex flex-col gap-2 rounded-[var(--radius-card)] border border-rule bg-surface px-5 py-4 shadow-[var(--shadow-card)]"
            style={{ animationDelay: `${280 + i * 80}ms` }}
          >
            <Ghost className="h-4 w-1/2" delay={300 + i * 80} />
            <Ghost className="h-3 w-full" delay={330 + i * 80} />
            <Ghost className="h-3 w-[85%]" delay={360 + i * 80} />
          </div>
        ))}
      </div>
    </div>
  );
}
