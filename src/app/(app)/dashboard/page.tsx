import { BookOpen, CalendarClock, Clock, Target } from "lucide-react";
import { Suspense, type ReactNode } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { PanelBoundary, SearchField, Skeleton, StatTile } from "@/components/ui";
import { ActivityPanel } from "@/features/dashboard/components/ActivityPanel";
import { FirstRun } from "@/features/dashboard/components/FirstRun";
import { MasteryPanel } from "@/features/dashboard/components/MasteryPanel";
import { PlanPanel } from "@/features/dashboard/components/PlanPanel";
import { ReadinessPanel } from "@/features/dashboard/components/ReadinessPanel";
import { UpcomingPanel } from "@/features/dashboard/components/UpcomingPanel";
import { WeakTopicsPanel } from "@/features/dashboard/components/WeakTopicsPanel";
import { EVENT_KIND_INFO } from "@/features/planner/schema";
import { isTimezone } from "@/features/planner/dates";
import {
  getComingUp,
  getLibrary,
  getMasteryOverview,
  getPlanToday,
  getStudyActivity,
} from "@/server/dashboard/queries";
import { getAttention } from "@/server/mastery/queries";
import { getProfile } from "@/server/profile/queries";
import { formatPercent } from "@/lib/utils";

export const metadata = { title: "Home" };

/**
 * The dashboard — the screen that has to answer "what should I do today?"
 * before the student has to think about it (FR-D1, FR-D3, US-J3).
 *
 * **Every panel loads and fails on its own (Sprint 70).** The page awaits
 * exactly one thing before drawing — the library, because it decides between
 * this dashboard and the first-run one — and every panel after that is its own
 * async component inside its own Suspense AND its own `PanelBoundary`.
 * Suspense covers a slow query; only the error boundary covers a failed one.
 * Before this, one `getDashboardData` awaited every read, so the slowest query
 * set the pace of the whole page and any failure replaced it with error.tsx.
 *
 * **A new account gets one action, not seven empty panels.** No subject, or
 * no file yet, renders `FirstRun` instead (FR-D3).
 *
 * Layout, top to bottom: four headline figures, then three columns — the plan
 * on the left because it is the answer to the question, the measurements in the
 * middle, and what is coming on the right. Below `xl` it stacks in that same
 * order, so the answer stays first on a phone.
 */
export default async function Page() {
  const [library, profile] = await Promise.all([getLibrary(), getProfile()]);
  const firstName = profile?.displayName?.split(" ")[0] || "there";
  const greeting = `${greetingFor(profile?.timezone)}, ${firstName}`;

  if (library.subjectCount === 0 || library.materialCount === 0) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          eyebrow={library.subjectCount === 0 ? "Welcome to Acadify" : "Nearly there"}
          title={greeting}
          description="Two steps and this page starts planning your study for you."
        />
        <FirstRun
          subjectCount={library.subjectCount}
          firstSubjectId={library.subjects[0]?.id ?? null}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Here is what will move your grades most today"
        title={greeting}
        action={<SearchField placeholder="Search subjects, materials and topics" />}
      />

      {/* Four numbers, not four charts. When the story is one figure, a chart is
          the figure with extra steps (docs/design-system.md §3). Each tile is
          its own boundary: the next exam must not wait on mastery. */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Panel title="Readiness" fallback={<TileSkeleton />}>
          <ReadinessTile />
        </Panel>
        <Panel title="Next exam" fallback={<TileSkeleton />}>
          <NextExamTile />
        </Panel>
        <Panel title="This week" fallback={<TileSkeleton />}>
          <WeekTile />
        </Panel>
        <Panel title="Quizzes taken" fallback={<TileSkeleton />}>
          <QuizzesTile />
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[20rem_minmax(0,1fr)_21rem] xl:items-start">
        <Panel title="Study plan" fallback={<PanelSkeleton tall />}>
          <PlanSlot hasSubjects={library.subjectCount > 0} />
        </Panel>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Mastery" fallback={<PanelSkeleton />}>
              <MasterySlot />
            </Panel>
            <Panel title="Activity" fallback={<PanelSkeleton />}>
              <ActivitySlot />
            </Panel>
          </div>
          {/* Already in hand — the library read it — so no boundary of its own
              is needed for loading; it still gets one for rendering. */}
          <PanelBoundary title="Readiness by subject">
            <ReadinessPanel subjects={library.subjects} />
          </PanelBoundary>
        </div>

        <div className="flex flex-col gap-4">
          <Panel title="Coming up" fallback={<PanelSkeleton />}>
            <UpcomingSlot />
          </Panel>
          <Panel title="Needs attention" fallback={<PanelSkeleton />}>
            <WeakTopicsSlot />
          </Panel>
        </div>
      </div>
    </div>
  );
}

/** One panel's two boundaries, always together — see the header. */
function Panel({
  title,
  fallback,
  children,
}: {
  title: string;
  fallback: ReactNode;
  children: ReactNode;
}) {
  return (
    <PanelBoundary title={title}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </PanelBoundary>
  );
}

/* ------------------------------------------------------------------ tiles */

async function ReadinessTile() {
  const { readiness, topicsTracked } = await getMasteryOverview();
  return (
    <StatTile
      label="Readiness"
      value={readiness === null ? "—" : formatPercent(readiness)}
      hint={readiness === null ? "Needs 10+ answers on a topic" : `across ${topicsTracked} topics`}
      Icon={Target}
      tone="accent"
    />
  );
}

/**
 * The next thing someone else will mark (US-J3: "next exam").
 *
 * The soonest assessed deadline, the same one the planner's countdown shows —
 * a quiz or an essay counts, a study session the student set themselves does
 * not. The whole tile goes to the planner, where the rest of the story is.
 */
async function NextExamTile() {
  const { nextExam } = await getComingUp();
  if (!nextExam) {
    return (
      <StatTile
        label="Next exam"
        value="—"
        hint="Nothing scheduled — add it in the planner"
        Icon={CalendarClock}
        href="/planner"
      />
    );
  }
  return (
    <StatTile
      label={`Next ${EVENT_KIND_INFO[nextExam.kind].label.toLowerCase()}`}
      value={countdown(nextExam.daysAway)}
      hint={nextExam.reason ? `${nextExam.title} · ${nextExam.reason}` : nextExam.title}
      Icon={CalendarClock}
      href="/planner"
    />
  );
}

async function WeekTile() {
  const { minutesThisWeek } = await getStudyActivity();
  return (
    <StatTile
      label="Studied this week"
      value={hoursAndMinutes(minutesThisWeek)}
      hint="Last 7 days, every finished session"
      Icon={Clock}
      href="/progress"
    />
  );
}

async function QuizzesTile() {
  const { quizzesTaken } = await getStudyActivity();
  return (
    <StatTile
      label="Quizzes taken"
      value={quizzesTaken}
      hint="Practice sets and quizzes finished"
      Icon={BookOpen}
      href="/quizzes"
    />
  );
}

/* ----------------------------------------------------------------- panels */

async function PlanSlot({ hasSubjects }: { hasSubjects: boolean }) {
  const data = await getPlanToday();
  return (
    <PlanPanel
      blocks={data.planToday}
      minutesRemaining={data.planMinutesRemaining}
      hasSubjects={hasSubjects}
      plan={data.plan}
      className="xl:sticky xl:top-0 xl:max-h-[calc(100dvh-12rem)]"
    />
  );
}

async function MasterySlot() {
  const data = await getMasteryOverview();
  return (
    <MasteryPanel
      bands={data.masteryBands}
      readiness={data.readiness}
      topicsTracked={data.topicsTracked}
    />
  );
}

async function ActivitySlot() {
  const data = await getStudyActivity();
  return (
    <ActivityPanel
      scores={data.scoreTrend}
      studyByDay={data.studyByDay}
      minutesThisWeek={data.minutesThisWeek}
    />
  );
}

async function UpcomingSlot() {
  const { upcoming } = await getComingUp();
  return <UpcomingPanel items={upcoming} />;
}

async function WeakTopicsSlot() {
  const attention = await getAttention({ limit: 4 });
  return <WeakTopicsPanel items={attention} />;
}

/* -------------------------------------------------------------- skeletons */

/* Shaped like what replaces them, so nothing jumps when a panel resolves
   (docs/states.md §1). */
function TileSkeleton() {
  return <Skeleton className="h-[6.5rem] rounded-[var(--radius-card)]" />;
}

function PanelSkeleton({ tall = false }: { tall?: boolean }) {
  return (
    <Skeleton
      className={
        tall ? "h-[28rem] rounded-[var(--radius-card)]" : "h-60 rounded-[var(--radius-card)]"
      }
    />
  );
}

/* ---------------------------------------------------------------- helpers */

/**
 * Good morning, afternoon or evening — on the STUDENT's clock.
 *
 * The server runs in UTC, so its hour says "Good evening" to Manila at 7am.
 * The same profile timezone every "today" in the app has used since Sprint 60.
 */
function greetingFor(timezone: string | null | undefined): string {
  const zone = isTimezone(timezone) ? timezone : "UTC";
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: zone }).format(
      new Date(),
    ),
  );
  if (hour < 5) return "Up late";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** "Today", "Tomorrow", "In 9 days" — the planner's own words for a countdown. */
function countdown(daysAway: number): string {
  if (daysAway <= 0) return "Today";
  if (daysAway === 1) return "Tomorrow";
  if (daysAway < 14) return `In ${daysAway} days`;
  if (daysAway < 60) return `In ${Math.round(daysAway / 7)} weeks`;
  return `In ${Math.round(daysAway / 30)} months`;
}

function hoursAndMinutes(total: number): string {
  if (total < 60) return `${total}m`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}
