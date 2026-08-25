import { ArrowLeft, ListTree } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, EmptyState, SectionLabel, Skeleton } from "@/components/ui";
import { SUBJECT_TONE, SubjectGlyph } from "@/features/subjects/components/SubjectIcon";
import { TopicDialog } from "@/features/topics/components/TopicDialog";
import { TopicList } from "@/features/topics/components/TopicList";
import { getSubject } from "@/server/subjects/queries";
import { listTopics } from "@/server/topics/queries";
import { cn } from "@/lib/utils";

/**
 * A subject's own page.
 *
 * **Scope note.** The full subject hub — materials, weak topics, recent
 * activity, overall progress — is FR-S5, Sprint 23. This is the minimum that
 * makes Sprint 21 usable: topics need somewhere to live, and the subject cards
 * shipped in Sprint 20 already link here. Sprint 23 fills in the rest around
 * the same header rather than replacing it.
 */

export async function generateMetadata({ params }: PageProps<"/subjects/[id]">) {
  const { id } = await params;
  const subject = await getSubject(id);
  return { title: subject?.name ?? "Subject" };
}

async function Topics({ subjectId }: { subjectId: string }) {
  const topics = await listTopics(subjectId);

  if (topics.length === 0) {
    return (
      <EmptyState
        Icon={ListTree}
        title="No topics yet"
        description="Topics are the chapters or units inside this subject. Filing files under one is what lets Pawgress tell you which parts you are weak on, rather than judging the whole class at once."
        action={<TopicDialog subjectId={subjectId} />}
      />
    );
  }

  return <TopicList subjectId={subjectId} topics={topics} />;
}

function TopicsSkeleton() {
  return (
    <Card>
      <CardBody className="flex flex-col gap-4 p-5">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </CardBody>
    </Card>
  );
}

export default async function Page({ params }: PageProps<"/subjects/[id]">) {
  const { id } = await params;
  const subject = await getSubject(id);

  /* RLS makes "not yours" and "does not exist" the same answer, and this
     renders the same 404 for both — telling a stranger that an id is real but
     off-limits is itself a leak. */
  if (!subject) notFound();

  const tone = SUBJECT_TONE[subject.colorSlot];

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/subjects"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        All subjects
      </Link>

      <PageHeader
        eyebrow={subject.semester ?? "Subject"}
        title={subject.name}
        description="Topics are how this subject gets broken into parts you can practise separately."
        action={<TopicDialog subjectId={subject.id} />}
      />

      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-control)]",
            tone.tint,
            tone.ink,
          )}
        >
          <SubjectGlyph icon={subject.icon} className="size-5" />
        </span>
        <p className="text-sm text-ink-muted">
          {subject.materialCount} {subject.materialCount === 1 ? "file" : "files"} ·{" "}
          {subject.topicCount} {subject.topicCount === 1 ? "topic" : "topics"}
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <SectionLabel>Topics</SectionLabel>
        <Suspense fallback={<TopicsSkeleton />}>
          <Topics subjectId={subject.id} />
        </Suspense>
      </section>
    </div>
  );
}
