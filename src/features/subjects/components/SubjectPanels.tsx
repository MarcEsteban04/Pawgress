import {
  ArrowRight,
  CalendarDays,
  FileText,
  Gauge,
  History,
  Target,
  TrendingUp,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { type ReactNode } from "react";
import {
  Card,
  CardActions,
  CardBody,
  CardHeader,
  CardTitle,
  MasteryBar,
  Skeleton,
  StatusBadge,
} from "@/components/ui";
import { PanelEmpty } from "@/features/dashboard/components/PanelEmpty";
import {
  type SubjectActivityItem,
  type SubjectMaterial,
  type SubjectProgress,
  type SubjectUpcoming,
  type SubjectWeakTopic,
} from "@/server/subjects/detail";
import { LOW_EVIDENCE_QUESTIONS, WEAK_TOPIC_THRESHOLD } from "@/types";
import { formatPercent } from "@/lib/utils";

/**
 * The panels of the subject page (FR-S5, US-B5).
 *
 * They share a file because they share one rule and it is easier to keep them
 * honest side by side: **a panel with nothing to show says WHY it is empty.**
 * `PanelEmpty` draws the distinction — `action` when the student can fill it
 * right now, `awaiting` when the feature that fills it does not exist yet.
 * Telling someone to "take a quiz" before quizzes are built is a lie that costs
 * the next message its credibility.
 *
 * `PanelEmpty` is imported from the dashboard rather than copied. The two
 * surfaces answer the same question at different scopes, and two copies would
 * drift until "empty" meant something different on each page.
 */

/** "3 days ago" beats a date a student has to subtract from today. */
function relative(iso: string): string {
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

/* ------------------------------------------------------------------ progress */

export function ProgressPanel({ progress }: { progress: SubjectProgress }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Readiness</CardTitle>
      </CardHeader>
      <CardBody>
        {progress.mastery === null ? (
          <PanelEmpty
            Icon={Gauge}
            title="Nothing measured yet"
            description="Readiness is worked out from the questions you answer, so it fills in once you have taken a quiz on this subject."
            awaiting={`Needs ${LOW_EVIDENCE_QUESTIONS} answered questions.`}
          />
        ) : (
          <div className="flex flex-col gap-4">
            <MasteryBar
              value={progress.mastery}
              questionCount={progress.questionsAnswered}
              hideEvidence
            />
            <dl className="flex gap-8">
              <div>
                <dd className="tabular font-display text-2xl leading-none font-semibold">
                  {formatPercent(progress.mastery)}
                </dd>
                <dt className="mt-1.5 text-[0.6875rem] font-medium tracking-[0.09em] text-ink-subtle uppercase">
                  Readiness
                </dt>
              </div>
              <div>
                <dd className="tabular font-display text-2xl leading-none font-semibold">
                  {progress.measuredTopics}/{progress.topicCount}
                </dd>
                <dt className="mt-1.5 text-[0.6875rem] font-medium tracking-[0.09em] text-ink-subtle uppercase">
                  Topics measured
                </dt>
              </div>
            </dl>
            {/* The figure is a ratio of totals, so it is only as complete as
                the topics behind it. Saying which ones are missing stops it
                being read as a verdict on the whole subject. */}
            {progress.measuredTopics < progress.topicCount && (
              <p className="text-sm text-ink-muted">
                Based on {progress.questionsAnswered} answers across {progress.measuredTopics} of{" "}
                {progress.topicCount} topics. The rest have not been practised enough to count.
              </p>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

/* --------------------------------------------------------------- weak topics */

export function WeakTopicsPanel({
  topics,
  measuredTopics,
}: {
  topics: SubjectWeakTopic[];
  measuredTopics: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Needs attention</CardTitle>
      </CardHeader>
      <CardBody>
        {topics.length === 0 ? (
          <PanelEmpty
            Icon={TrendingUp}
            title={measuredTopics > 0 ? "Nothing flagged" : "Nothing measured yet"}
            description={
              measuredTopics > 0
                ? `Every topic with enough evidence is above ${formatPercent(WEAK_TOPIC_THRESHOLD)}. Nothing here is holding you back.`
                : "The weakest topics are listed here once you have answered enough questions on them to tell them apart."
            }
            awaiting={
              measuredTopics > 0
                ? undefined
                : `Needs ${LOW_EVIDENCE_QUESTIONS} answers on a topic before it can be ranked.`
            }
          />
        ) : (
          <div className="flex flex-col gap-4">
            {/* The threshold is stated, not implied (US-H1). A list called
                "weak" with no stated line is an opinion presented as a fact. */}
            <p className="text-sm text-ink-muted">
              Below {formatPercent(WEAK_TOPIC_THRESHOLD)}, weakest first.
            </p>
            <ul className="flex flex-col gap-3.5">
              {topics.map((topic) => (
                <li key={topic.id}>
                  <MasteryBar
                    value={topic.mastery}
                    questionCount={topic.questionsAnswered}
                    label={topic.name}
                    dense
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

/* ----------------------------------------------------------------- materials */

export function MaterialsPanel({
  materials,
  totalCount,
  action,
  libraryHref,
}: {
  materials: SubjectMaterial[];
  totalCount: number;
  /** Where the full library lives, so the preview can point at it. */
  libraryHref?: string;
  /** The upload control. Passed in because this file is a Server Component. */
  action?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Materials</CardTitle>
        {action && <CardActions>{action}</CardActions>}
      </CardHeader>
      <CardBody className={materials.length > 0 ? "p-0" : undefined}>
        {materials.length === 0 ? (
          /* No longer an "awaiting" empty state: uploading exists now, so this
             offers the action instead of apologising for its absence. What is
             still awaited is PROCESSING, and the queued badge on each row says
             so without this panel having to. */
          /* The action appears here as well as in the header. This is where a
             student who just found an empty panel is already looking, and
             sending them back up to a button they have scrolled past is the
             kind of small friction that makes a feature feel unfinished. */
          <PanelEmpty
            Icon={Upload}
            title="No files yet"
            control={action}
            description="Lecture slides, notes and past papers go here. Everything Acadify generates — reviewers, flashcards, quizzes — is built from them."
          />
        ) : (
          <>
            <ul className="divide-y divide-rule">
              {materials.map((material) => (
                <li key={material.id} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                  <FileText className="size-4 shrink-0 text-ink-subtle" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.9375rem] font-medium">{material.title}</p>
                    <p className="mt-0.5 text-xs text-ink-subtle">
                      {[material.topicName, relative(material.createdAt)]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <StatusBadge status={material.status} />
                </li>
              ))}
            </ul>
            {/* The panel is a preview, so it always offers the way to the
                full library rather than only when the preview overflows —
                renaming and re-filing live there, and a student who cannot
                see the door assumes there is no room. */}
            <div className="flex items-center justify-between gap-3 px-5 py-3 sm:px-6">
              <p className="text-sm text-ink-muted">
                {totalCount > materials.length
                  ? `Showing ${materials.length} of ${totalCount}.`
                  : `${totalCount} ${totalCount === 1 ? "file" : "files"}.`}
              </p>
              {libraryHref && (
                <Link
                  href={libraryHref}
                  className="inline-flex items-center gap-1 text-sm font-medium transition-colors hover:text-accent"
                >
                  Manage files
                  <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              )}
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}

/* ------------------------------------------------------------------ upcoming */

export function UpcomingPanel({ items }: { items: SubjectUpcoming[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming</CardTitle>
      </CardHeader>
      <CardBody>
        {items.length === 0 ? (
          <PanelEmpty
            Icon={CalendarDays}
            title="Nothing scheduled"
            description="Exams and deadlines for this subject appear here, soonest first, with how ready you are for each."
            awaiting="The planner arrives later in the roadmap."
          />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-[var(--radius-tile)] bg-surface-sunken p-3.5"
              >
                <Target className="size-4 shrink-0 text-ink-subtle" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.9375rem] font-medium">{item.title}</p>
                  <p className="mt-0.5 text-xs text-ink-subtle capitalize">{item.kind}</p>
                </div>
                <span className="tabular shrink-0 text-sm font-medium">
                  {item.inDays === 0 ? "today" : `${item.inDays}d`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

/* ------------------------------------------------------------------ activity */

const ACTIVITY_VERB = {
  material: "Added",
  quiz: "Scored",
  session: "Studied",
} as const;

export function ActivityPanel({ items }: { items: SubjectActivityItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
      </CardHeader>
      <CardBody>
        {items.length === 0 ? (
          <PanelEmpty
            Icon={History}
            title="Nothing yet"
            description="Uploads, quiz attempts and study sessions for this subject show up here as you go."
            action={{ href: "/subjects", label: "Back to subjects" }}
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((item) => (
              <li key={item.id} className="flex items-baseline gap-3 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  <span className="text-ink-muted">{ACTIVITY_VERB[item.kind]} </span>
                  <span className="font-medium capitalize">{item.title}</span>
                  {item.detail && item.kind !== "material" && (
                    <span className="tabular text-ink-muted"> · {item.detail}</span>
                  )}
                </span>
                <span className="shrink-0 text-xs text-ink-subtle">{relative(item.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

/** One panel's loading state. Card-shaped, so nothing jumps when it resolves. */
export function PanelSkeleton({ title }: { title: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardBody className="flex flex-col gap-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
      </CardBody>
    </Card>
  );
}
