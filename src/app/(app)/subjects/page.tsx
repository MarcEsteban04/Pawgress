import { Layers, Pencil } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, Card, CardBody, EmptyState, Tag } from "@/components/ui";
import { DeleteSubjectDialog } from "@/features/subjects/components/DeleteSubjectDialog";
import { SubjectDialog } from "@/features/subjects/components/SubjectDialog";
import { SUBJECT_TONE, subjectIconFor } from "@/features/subjects/components/SubjectIcon";
import { getDeletionSummary, listSubjects } from "@/server/subjects/queries";
import { cn } from "@/lib/utils";

export const metadata = { title: "Subjects" };

export default async function Page() {
  const subjects = await listSubjects();

  /* Deletion counts are computed here rather than when the dialog opens: a
     Server Component cannot be called on demand from a click, and a stale count
     in a destructive confirmation is worse than a few extra queries on a page
     that lists at most a dozen subjects. Sprint 20 revisits this if the list
     grows. */
  const summaries = await Promise.all(
    subjects.map(async (subject) => [subject.id, await getDeletionSummary(subject.id)] as const),
  );
  const summaryById = new Map(summaries);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="One place per class"
        title="Subjects"
        description="Your files, topics and quizzes live inside a subject."
        action={subjects.length > 0 ? <SubjectDialog /> : undefined}
      />

      {subjects.length === 0 ? (
        <EmptyState
          Icon={Layers}
          title="No subjects yet"
          description="A subject is one class — Biology, Programming, History. Everything you upload lives inside one, so this is the first thing to make."
          action={<SubjectDialog />}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {subjects.map((subject) => {
            const Glyph = subjectIconFor(subject.icon);
            const tone = SUBJECT_TONE[subject.colorSlot];
            const summary = summaryById.get(subject.id);

            return (
              <li key={subject.id}>
                <Card className="flex h-full flex-col">
                  <CardBody className="flex flex-1 flex-col gap-4 pt-5">
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-control)]",
                          tone.tint,
                          tone.ink,
                        )}
                      >
                        <Glyph className="size-5" aria-hidden />
                      </span>

                      <div className="min-w-0 flex-1">
                        {/* A real link, so ctrl-click opens the subject in a new
                            tab (docs/navigation.md §1). The hub itself is
                            Sprint 23. */}
                        <Link
                          href={`/subjects/${subject.id}`}
                          className="font-display text-lg leading-tight font-semibold hover:underline"
                        >
                          {subject.name}
                        </Link>
                        {subject.semester && (
                          <p className="mt-1 text-sm text-ink-subtle">{subject.semester}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Tag>
                        {subject.materialCount} {subject.materialCount === 1 ? "file" : "files"}
                      </Tag>
                      <Tag>
                        {subject.topicCount} {subject.topicCount === 1 ? "topic" : "topics"}
                      </Tag>
                    </div>

                    <div className="mt-auto flex items-center gap-1 border-t border-rule pt-3">
                      <SubjectDialog
                        subject={subject}
                        trigger={
                          <Button variant="ghost" size="sm" aria-label={`Edit ${subject.name}`}>
                            <Pencil aria-hidden />
                          </Button>
                        }
                      />
                      {summary && (
                        <DeleteSubjectDialog
                          subjectId={subject.id}
                          subjectName={subject.name}
                          summary={summary}
                        />
                      )}
                    </div>
                  </CardBody>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
