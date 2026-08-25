import { PageHeader } from "@/components/layout/PageHeader";
import { SearchField } from "@/components/ui";
import { MasteryPanel } from "@/features/dashboard/components/MasteryPanel";
import { PlanPanel } from "@/features/dashboard/components/PlanPanel";
import { ReadinessPanel } from "@/features/dashboard/components/ReadinessPanel";
import { UpcomingPanel } from "@/features/dashboard/components/UpcomingPanel";
import { WeakTopicsPanel } from "@/features/dashboard/components/WeakTopicsPanel";
import { getDashboardData } from "@/server/dashboard/queries";
import { getProfile } from "@/server/profile/queries";

export const metadata = { title: "Home" };

/**
 * The dashboard — the screen that has to answer "what should I do today?"
 * before the student has to think about it (FR-D1, FR-D3).
 *
 * Reads the real database. The placeholder set that used to fill it is gone:
 * it made the design reviewable before the tables existed, and kept any longer
 * it would have been a lie the product told about itself on every load.
 *
 * Most panels are empty for a new account, and each says which — whether the
 * student can fill it now, or whether the feature that fills it is still to
 * come. That distinction is the whole point of `PanelEmpty`.
 *
 * Server Component throughout. Only the donut's hover layer is client-side.
 */
export default async function Page() {
  const [data, profile] = await Promise.all([getDashboardData(), getProfile()]);

  const firstName = profile?.displayName.split(" ")[0] ?? "there";
  const hasSubjects = data.subjects.length > 0;

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

      <div className="grid gap-4 xl:grid-cols-[20rem_minmax(0,1fr)_21rem] xl:items-start">
        <PlanPanel
          blocks={data.planToday}
          minutesRemaining={data.planMinutesRemaining}
          hasSubjects={hasSubjects}
          className="xl:sticky xl:top-0 xl:max-h-[calc(100dvh-12rem)]"
        />

        <div className="flex min-w-0 flex-col gap-4">
          <MasteryPanel
            bands={data.masteryBands}
            readiness={data.readiness}
            topicsTracked={data.topicsTracked}
          />
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
