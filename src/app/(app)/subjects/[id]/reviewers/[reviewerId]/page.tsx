import { ArrowLeft, Layers, Sparkles, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardBody, SectionLabel, StatusBadge } from "@/components/ui";
import { GenerateFlashcardsButton } from "@/features/flashcards/components/GenerateFlashcardsButton";
import { countFlashcards } from "@/server/flashcards/queries";
import { getReviewer } from "@/server/reviewers/queries";
import { getSubject } from "@/server/subjects/queries";

/**
 * One generated reviewer (FR-R1, US-F1).
 *
 * **Four sections in a fixed order, because the order is the advice.** Summary
 * first for the student with two minutes; then what to revise first, because
 * knowing where to start is worth more than any single explanation; then the
 * concepts; then the terms. Reversing that would produce a glossary with a
 * summary attached.
 *
 * The page re-renders on navigation rather than polling. Generation takes about
 * a minute, and a poll that fires every two seconds for a minute is thirty
 * requests to learn one thing — the state is on screen and honest, and a reload
 * is one key.
 */

export async function generateMetadata({
  params,
}: PageProps<"/subjects/[id]/reviewers/[reviewerId]">) {
  const { reviewerId } = await params;
  const reviewer = await getReviewer(reviewerId);
  return { title: reviewer?.title ?? "Reviewer" };
}

export default async function Page({ params }: PageProps<"/subjects/[id]/reviewers/[reviewerId]">) {
  const { id, reviewerId } = await params;
  const [subject, reviewer, cardCount] = await Promise.all([
    getSubject(id),
    getReviewer(reviewerId),
    countFlashcards(reviewerId),
  ]);

  if (!subject || !reviewer) notFound();

  const content = reviewer.content;

  return (
    <div className="mx-auto flex w-full max-w-[52rem] flex-col gap-5">
      <Link
        href={`/subjects/${id}`}
        className="inline-flex w-fit items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {subject.name}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-ink-subtle">
            {[
              reviewer.topicName,
              `${reviewer.sourceCount} source${reviewer.sourceCount === 1 ? "" : "s"}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <h1 className="mt-1 font-display text-2xl leading-tight font-semibold tracking-[-0.02em]">
            {reviewer.title}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {/* Offered only once there is something to make cards FROM. A button
              on a reviewer that is still being written can only fail, and a
              button whose whole job is to explain why it will not work is a
              worse answer than not being there. */}
          {reviewer.status === "ready" &&
            (cardCount > 0 ? (
              <Link
                href={`/subjects/${id}/reviewers/${reviewerId}/flashcards`}
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-rule bg-surface px-3.5 py-2 text-sm font-medium transition-colors hover:border-rule-strong hover:bg-surface-sunken"
              >
                <Layers className="size-4" aria-hidden />
                Study {cardCount} cards
              </Link>
            ) : (
              <GenerateFlashcardsButton subjectId={id} reviewerId={reviewerId} size="sm" />
            ))}
          <StatusBadge status={reviewer.status} />
        </div>
      </div>

      {/* Three states, and they are genuinely different. Still working is not a
          failure; failed is not empty; and a reviewer with no content but a
          ready status would be a bug worth seeing rather than hiding. */}
      {reviewer.status !== "ready" && !content && (
        <Card>
          <CardBody className="flex items-start gap-3 py-5">
            {reviewer.status === "failed" ? (
              <>
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden />
                <p className="text-sm leading-relaxed">
                  {reviewer.failureMessage ?? "This reviewer could not be generated."} Nothing was
                  lost — your material is untouched.
                </p>
              </>
            ) : (
              <>
                <Sparkles
                  className="mt-0.5 size-4 shrink-0 animate-pulse text-accent"
                  aria-hidden
                />
                <p className="text-sm leading-relaxed text-ink-muted">
                  Aki is reading your material and writing this. It usually takes under a minute —
                  reload the page to see it.
                </p>
              </>
            )}
          </CardBody>
        </Card>
      )}

      {content && (
        <div className="flex flex-col gap-5">
          <Card>
            <CardBody className="py-5">
              <p className="leading-relaxed">{content.summary}</p>
            </CardBody>
          </Card>

          {content.focus.length > 0 && (
            <section className="flex flex-col gap-3">
              <SectionLabel>Revise first</SectionLabel>
              <Card>
                <CardBody className="py-4">
                  <ol className="flex list-outside list-decimal flex-col gap-2 pl-5 marker:text-ink-subtle">
                    {content.focus.map((item) => (
                      <li key={item} className="leading-relaxed">
                        {item}
                      </li>
                    ))}
                  </ol>
                </CardBody>
              </Card>
            </section>
          )}

          <section className="flex flex-col gap-3">
            <SectionLabel>Key concepts</SectionLabel>
            <div className="grid gap-3 md:grid-cols-2">
              {content.concepts.map((concept) => (
                <Card key={concept.name}>
                  <CardBody className="py-4">
                    <h2 className="font-display font-semibold">{concept.name}</h2>
                    <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-muted">
                      {concept.explanation}
                    </p>
                  </CardBody>
                </Card>
              ))}
            </div>
          </section>

          {content.terms.length > 0 && (
            <section className="flex flex-col gap-3">
              <SectionLabel>Key terms</SectionLabel>
              <Card>
                <CardBody className="p-0">
                  <dl className="divide-y divide-rule">
                    {content.terms.map((term) => (
                      <div
                        key={term.term}
                        className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:gap-5"
                      >
                        <dt className="font-medium sm:w-48 sm:shrink-0">{term.term}</dt>
                        <dd className="text-[0.9375rem] leading-relaxed text-ink-muted">
                          {term.definition}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </CardBody>
              </Card>
            </section>
          )}

          {/* Said once, at the end, where a student has finished reading and is
              deciding whether to trust it. */}
          <p className="text-xs leading-relaxed text-ink-subtle">
            Written by Aki from {reviewer.sourceCount} of your{" "}
            {reviewer.sourceCount === 1 ? "file" : "files"}. Check it against your material before
            relying on it for an exam.
          </p>
        </div>
      )}
    </div>
  );
}
