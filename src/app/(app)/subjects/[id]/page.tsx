import { Archive, ArrowLeft, ListTree } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, EmptyState, SectionLabel, Skeleton } from "@/components/ui";
import { ArchiveSubjectButton } from "@/features/subjects/components/ArchiveSubjectButton";
import { SUBJECT_TONE, SubjectGlyph } from "@/features/subjects/components/SubjectIcon";
import {
  ActivityPanel,
  MaterialsPanel,
  PanelSkeleton,
  ProgressPanel,
  UpcomingPanel,
  WeakTopicsPanel,
} from "@/features/subjects/components/SubjectPanels";
import { TopicDialog } from "@/features/topics/components/TopicDialog";
import { TopicList } from "@/features/topics/components/TopicList";
import {
  getSubjectProgress,
  listSubjectActivity,
  listSubjectMaterials,
  listSubjectUpcoming,
  listSubjectWeakTopics,
} from "@/server/subjects/detail";
import { getSubject } from "@/server/subjects/queries";
import { formatAcademicYear } from "@/lib/validation/subject";
import { listTopics } from "@/server/topics/queries";
import { cn } from "@/lib/utils";

/**
 * The subject hub (FR-S5, US-B5).
 *
 * **Every panel is its own Suspense boundary, and that is the requirement, not
 * a flourish.** US-B5 says a section must never block the others from
 * rendering. One `getSubjectDetail()` awaited at the top would make the whole
 * page as slow as its slowest query and blank while it waited; six independent
 * boundaries mean each panel streams in as its own data lands, and a panel that
 * fails takes only its own card down.
 *
 * The header — name, colour, counts — is awaited directly rather than
 * suspended. It is the one thing the page cannot be identified without, and a
 * page whose title arrives second reads as broken.
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

async function Progress({ subjectId }: { subjectId: string }) {
  const progress = await getSubjectProgress(subjectId);
  return <ProgressPanel progress={progress} />;
}

/**
 * Weak topics needs the progress summary too, to tell "nothing is weak" apart
 * from "nothing has been measured". Both calls are `cache()`d, so asking twice
 * in one render costs one query — which is exactly what lets the two panels
 * stay independent instead of being merged to share a fetch.
 */
async function WeakTopics({ subjectId }: { subjectId: string }) {
  const [topics, progress] = await Promise.all([
    listSubjectWeakTopics(subjectId),
    getSubjectProgress(subjectId),
  ]);
  return <WeakTopicsPanel topics={topics} measuredTopics={progress.measuredTopics} />;
}

async function Materials({ subjectId, totalCount }: { subjectId: string; totalCount: number }) {
  const materials = await listSubjectMaterials(subjectId);
  return <MaterialsPanel materials={materials} totalCount={totalCount} />;
}

async function Upcoming({ subjectId, today }: { subjectId: string; today: string }) {
  const items = await listSubjectUpcoming(subjectId, today);
  return <UpcomingPanel items={items} />;
}

async function Activity({ subjectId }: { subjectId: string }) {
  const items = await listSubjectActivity(subjectId);
  return <ActivityPanel items={items} />;
}

export default async function Page({ params }: PageProps<"/subjects/[id]">) {
  const { id } = await params;
  const subject = await getSubject(id);

  /* RLS makes "not yours" and "does not exist" the same answer, and this
     renders the same 404 for both — telling a stranger that an id is real but
     off-limits is itself a leak. */
  if (!subject) notFound();

  const tone = SUBJECT_TONE[subject.colorSlot];
  const archived = subject.archivedAt !== null;

  /* One clock reading for the whole render. Two panels computing "days until"
     from their own `new Date()` can straddle midnight and disagree by a day. */
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-5">
      <Link
        href={archived ? "/subjects?archived=1" : "/subjects"}
        className="inline-flex w-fit items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {archived ? "Archived subjects" : "All subjects"}
      </Link>

      {/* US-B6 promises an archived subject stays READABLE, so the page opens
          normally rather than redirecting. What it must not do is stay silent:
          a student wondering why this subject vanished from their list should
          find the answer here, next to the control that undoes it. */}
      {archived && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-tile)] border border-rule bg-surface-sunken px-4 py-3">
          <p className="flex items-center gap-2 text-sm text-ink-muted">
            <Archive className="size-4 shrink-0" aria-hidden />
            Archived. Everything here is intact — it is just hidden from your subject list.
          </p>
          <ArchiveSubjectButton
            subjectId={subject.id}
            subjectName={subject.name}
            archived
            variant="labelled"
          />
        </div>
      )}

      <div className="flex items-start gap-4">
        <span
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-control)]",
            tone.tint,
            tone.ink,
          )}
        >
          <SubjectGlyph icon={subject.icon} className="size-6" />
        </span>
        <PageHeader
          className="flex-1"
          eyebrow={
            [
              subject.academicYear !== null ? formatAcademicYear(subject.academicYear) : null,
              subject.semester,
            ]
              .filter(Boolean)
              .join(" · ") || "Subject"
          }
          title={subject.name}
          description={`${subject.materialCount} ${subject.materialCount === 1 ? "file" : "files"} · ${subject.topicCount} ${subject.topicCount === 1 ? "topic" : "topics"}`}
          action={<TopicDialog subjectId={subject.id} />}
        />
      </div>

      {/* Readiness and what to do about it sit together, because one is the
          answer to the other. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Suspense fallback={<PanelSkeleton title="Readiness" />}>
          <Progress subjectId={subject.id} />
        </Suspense>
        <Suspense fallback={<PanelSkeleton title="Needs attention" />}>
          <WeakTopics subjectId={subject.id} />
        </Suspense>
      </div>

      <section className="flex flex-col gap-3">
        <SectionLabel>Topics</SectionLabel>
        <Suspense fallback={<TopicsSkeleton />}>
          <Topics subjectId={subject.id} />
        </Suspense>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Suspense fallback={<PanelSkeleton title="Materials" />}>
          <Materials subjectId={subject.id} totalCount={subject.materialCount} />
        </Suspense>
        <Suspense fallback={<PanelSkeleton title="Upcoming" />}>
          <Upcoming subjectId={subject.id} today={today} />
        </Suspense>
        <Suspense fallback={<PanelSkeleton title="Recent activity" />}>
          <Activity subjectId={subject.id} />
        </Suspense>
      </div>
    </div>
  );
}
