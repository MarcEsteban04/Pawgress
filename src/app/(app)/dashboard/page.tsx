import { BookOpen, FileText, Layers, Target } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchField, StatTile } from "@/components/ui";
import { ActivityPanel } from "@/features/dashboard/components/ActivityPanel";
import { MasteryPanel } from "@/features/dashboard/components/MasteryPanel";
import { PlanPanel } from "@/features/dashboard/components/PlanPanel";
import { ReadinessPanel } from "@/features/dashboard/components/ReadinessPanel";
import { UpcomingPanel } from "@/features/dashboard/components/UpcomingPanel";
import { WeakTopicsPanel } from "@/features/dashboard/components/WeakTopicsPanel";
import { getDashboardData } from "@/server/dashboard/queries";
import { getProfile } from "@/server/profile/queries";
import { formatPercent } from "@/lib/utils";

export const metadata = { title: "Home" };

/**
 * The dashboard — the screen that has to answer "what should I do today?"
 * before the student has to think about it (FR-D1, FR-D3).
 *
 * Reads the real database throughout. Panels that have nothing yet say which
 * kind of nothing: something the student can fix now, or a feature that does
 * not exist yet.
 *
 * Layout, top to bottom: four headline figures, then three columns — the plan
 * on the left because it is the answer to the question, the measurements in the
 * middle, and what is coming on the right. Below `xl` it stacks in that same
 * order, so the answer stays first on a phone.
 */
export default async function Page() {
  const [data, profile] = await Promise.all([getDashboardData(), getProfile()]);

  const firstName = profile?.displayName.split(" ")[0] ?? "there";
  const hasSubjects = data.stats.subjects > 0;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={
          hasSubjects
            ? "Here is what will move your grades most today"
            : `Welcome, ${firstName} — start by making a subject`
        }
        title="Study dashboard"
        action={<SearchField placeholder="Search subjects, materials and topics" />}
      />

      {/* Four numbers, not four charts. When the story is one figure, a chart is
          the figure with extra steps (docs/design-system.md §3). */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Readiness"
          value={data.readiness === null ? "—" : formatPercent(data.readiness)}
          hint={
            data.readiness === null
              ? "Needs 10+ answers on a topic"
              : `across ${data.stats.topicsTracked} topics`
          }
          Icon={Target}
          tone="accent"
        />
        <StatTile
          label="Subjects"
          value={data.stats.subjects}
          hint={hasSubjects ? "Tap to manage them" : "None yet"}
          Icon={Layers}
          href="/subjects"
        />
        <StatTile
          label="Materials"
          value={data.stats.materials}
          hint={data.stats.materials === 0 ? "Uploads arrive soon" : "Across all subjects"}
          Icon={FileText}
        />
        <StatTile
          label="Quizzes taken"
          value={data.stats.quizzesTaken}
          hint={`${data.stats.minutesThisWeek}m studied this week`}
          Icon={BookOpen}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[20rem_minmax(0,1fr)_21rem] xl:items-start">
        <PlanPanel
          blocks={data.planToday}
          minutesRemaining={data.planMinutesRemaining}
          hasSubjects={hasSubjects}
          className="xl:sticky xl:top-0 xl:max-h-[calc(100dvh-12rem)]"
        />

        <div className="flex min-w-0 flex-col gap-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <MasteryPanel
              bands={data.masteryBands}
              readiness={data.readiness}
              topicsTracked={data.stats.topicsTracked}
            />
            <ActivityPanel
              scores={data.scoreTrend}
              studyByDay={data.studyByDay}
              minutesThisWeek={data.stats.minutesThisWeek}
            />
          </div>
          <ReadinessPanel subjects={data.subjects} />
        </div>

        <div className="flex flex-col gap-4">
          <UpcomingPanel items={data.upcoming} />
          <WeakTopicsPanel topics={data.weakTopics} />
        </div>
      </div>
    </div>
  );
}
