import { FileText, Sparkles } from "lucide-react";
import Link from "next/link";
import { Card, CardActions, CardBody, CardHeader, CardTitle, StatusBadge } from "@/components/ui";
import { PanelEmpty } from "@/features/dashboard/components/PanelEmpty";
import { GenerateReviewerButton } from "./GenerateReviewerButton";
import { type ReviewerSummary } from "@/server/reviewers/queries";

/**
 * Reviewers for one subject (FR-R1, US-F1).
 *
 * The first panel in the product that shows something the app WROTE rather than
 * something the student uploaded, which is why every row carries its status and
 * its source count. A generated document that does not say what it was built
 * from is a document a student has to trust blindly.
 */
export function ReviewersPanel({
  subjectId,
  reviewers,
}: {
  subjectId: string;
  reviewers: ReviewerSummary[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reviewers</CardTitle>
        <CardActions>
          {/* Into the ONE library, pre-filtered to this subject. A second
              per-subject index would render a near-identical list at a second
              URL, and the two would drift. */}
          {reviewers.length > 0 && (
            <Link
              href={`/reviewers?subject=${subjectId}`}
              className="text-sm text-ink-muted transition-colors hover:text-ink"
            >
              See all
            </Link>
          )}
          <GenerateReviewerButton subjectId={subjectId} size="sm" label="Generate" />
        </CardActions>
      </CardHeader>

      <CardBody className={reviewers.length > 0 ? "p-0" : undefined}>
        {reviewers.length === 0 ? (
          <PanelEmpty
            Icon={Sparkles}
            title="No reviewers yet"
            description="Aki can read everything in this subject and write a revision aid — a summary, the key concepts and terms, and what to revise first."
            control={<GenerateReviewerButton subjectId={subjectId} size="sm" />}
          />
        ) : (
          <ul className="divide-y divide-rule">
            {reviewers.map((reviewer) => (
              <li key={reviewer.id}>
                <Link
                  href={`/subjects/${subjectId}/reviewers/${reviewer.id}`}
                  className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-sunken"
                >
                  <FileText className="size-4 shrink-0 text-ink-subtle" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.9375rem] font-medium">
                      {reviewer.title}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-ink-subtle">
                      {[
                        reviewer.topicName,
                        `${reviewer.sourceCount} source${reviewer.sourceCount === 1 ? "" : "s"}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <StatusBadge status={reviewer.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
