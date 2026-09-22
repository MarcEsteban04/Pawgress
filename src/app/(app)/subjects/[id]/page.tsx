import { Archive, ArrowLeft, ListTree, Sparkles, Upload } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  Button,
  buttonStyles,
  Card,
  CardBody,
  EmptyState,
  PanelBoundary,
  SectionLabel,
  Skeleton,
} from "@/components/ui";
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
import { UploadDialog } from "@/features/materials/components/UploadDialog";
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
 * **Every panel is its own Suspense boundary AND its own error boundary.**
 * US-B5 says a section must never block the others from rendering. One
 * `getSubjectDetail()` awaited at the top would make the whole page as slow as
 * its slowest query and blank while it waited; independent boundaries mean each
 * panel streams in as its own data lands.
 *
 * Suspense alone only covers half of that. It handles a PENDING promise; a
 * rejected one passes through it to the nearest error boundary, which without
 * `PanelBoundary` is this route's `error.tsx` — replacing the entire page over
 * one failed query. Sprint 23 claimed the isolation; this pairs each Suspense
 * with the boundary that actually delivers it.
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
        description="Topics are the chapters or units inside this subject. Filing files under one is what lets Acadify tell you which parts you are weak on, rather than judging the whole class at once."
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

/**
 * The upload control needs the subject's topics so a file can be filed under
 * one as it is uploaded (FR-U1). `listTopics` is `cache()`d and the topic
 * section already asked for it, so this is the same query, not a second one.
 */
async function Materials({ subjectId, totalCount }: { subjectId: string; totalCount: number }) {
  const [materials, topics] = await Promise.all([
    listSubjectMaterials(subjectId),
    listTopics(subjectId),
  ]);

  return (
    <MaterialsPanel
      materials={materials}
      totalCount={totalCount}
      libraryHref={`/subjects/${subjectId}/materials`}
      action={
        <UploadDialog
          subjectId={subjectId}
          topics={topics}
          trigger={
            <Button variant="subtle" size="sm">
              <Upload aria-hidden />
              Upload
            </Button>
          }
        />
      }
    />
  );
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

  /* The header's upload dialog needs the topics to offer. Awaited here rather
     than suspended because the header is not a panel — it renders once, whole.
     `listTopics` is `cache()`d, so the topic list below reuses this result
     instead of asking again. */
  const headerTopics = await listTopics(subject.id);

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

      {/**
       * One row: mark, name, and everything true about the subject on a single
       * line beneath it.
       *
       * This was a `PageHeader` carrying an eyebrow, a display title and a
       * description — three stacked lines plus a 48px tile, for a page whose
       * content is a list. The year, the semester and the counts are all the
       * same KIND of fact, so they read as one line rather than as a subtitle
       * and a caption; and the title drops from display size to something
       * proportionate to a page you open twenty times a day.
       */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-control)]",
            tone.tint,
            tone.ink,
          )}
        >
          <SubjectGlyph icon={subject.icon} className="size-5" />
        </span>

        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-2xl leading-tight font-semibold tracking-[-0.02em]">
            {subject.name}
          </h1>
          <p className="mt-0.5 truncate text-sm text-ink-subtle">
            {[
              subject.academicYear !== null ? formatAcademicYear(subject.academicYear) : null,
              subject.semester,
              `${subject.materialCount} ${subject.materialCount === 1 ? "file" : "files"}`,
              `${subject.topicCount} ${subject.topicCount === 1 ? "topic" : "topics"}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          {/* Scope carried from the page a student is already on. Opening Ask
              from here and finding it set to "all your subjects" would make
              them re-answer a question the app already knew the answer to. */}
          <Link
            href={`/assistant?subject=${subject.id}`}
            className={buttonStyles({ variant: "subtle" })}
          >
            <Sparkles aria-hidden />
            Ask Aki
          </Link>
          <UploadDialog subjectId={subject.id} topics={headerTopics} />
          <TopicDialog subjectId={subject.id} />
        </div>
      </div>

      {/**
       * Order follows what a student can act on TODAY, not what will matter
       * eventually.
       *
       * Readiness and weak topics were the first thing on this page, and they
       * are two large cards that say "nothing measured yet" and will keep
       * saying it until quizzes exist (Sprint 49+). They pushed the topics and
       * the files — the only parts that currently do anything — below the fold,
       * so uploading a file meant scrolling past two apologies.
       *
       * Work first, then measurement. When mastery is real, it earns its place
       * back by being useful rather than by being at the top.
       */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:items-start">
        <section className="flex flex-col gap-3">
          <SectionLabel>Topics</SectionLabel>
          <PanelBoundary title="Topics">
            <Suspense fallback={<TopicsSkeleton />}>
              <Topics subjectId={subject.id} />
            </Suspense>
          </PanelBoundary>
        </section>

        {/* Beside the topics rather than under them: a file belongs to a topic,
            and putting the two on one screen is what makes that visible. */}
        <section className="flex flex-col gap-3">
          <SectionLabel>Files</SectionLabel>
          <PanelBoundary title="Materials">
            <Suspense fallback={<PanelSkeleton title="Materials" />}>
              <Materials subjectId={subject.id} totalCount={subject.materialCount} />
            </Suspense>
          </PanelBoundary>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <PanelBoundary title="Readiness">
          <Suspense fallback={<PanelSkeleton title="Readiness" />}>
            <Progress subjectId={subject.id} />
          </Suspense>
        </PanelBoundary>
        <PanelBoundary title="Needs attention">
          <Suspense fallback={<PanelSkeleton title="Needs attention" />}>
            <WeakTopics subjectId={subject.id} />
          </Suspense>
        </PanelBoundary>
        <PanelBoundary title="Upcoming">
          <Suspense fallback={<PanelSkeleton title="Upcoming" />}>
            <Upcoming subjectId={subject.id} today={today} />
          </Suspense>
        </PanelBoundary>
        <PanelBoundary title="Recent activity">
          <Suspense fallback={<PanelSkeleton title="Recent activity" />}>
            <Activity subjectId={subject.id} />
          </Suspense>
        </PanelBoundary>
      </div>
    </div>
  );
}
