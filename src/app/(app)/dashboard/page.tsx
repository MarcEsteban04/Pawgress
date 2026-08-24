import { PageHeader } from "@/components/layout/PageHeader";
import { SampleDataNotice } from "@/components/shared/SampleDataNotice";
import { SearchField, SegmentedNav, SegmentedNavItem } from "@/components/ui";
import { MasteryPanel } from "@/features/dashboard/components/MasteryPanel";
import { PlanPanel } from "@/features/dashboard/components/PlanPanel";
import { ReadinessPanel } from "@/features/dashboard/components/ReadinessPanel";
import { TrendPanel } from "@/features/dashboard/components/TrendPanel";
import { UpcomingPanel } from "@/features/dashboard/components/UpcomingPanel";
import { WeakTopicsPanel } from "@/features/dashboard/components/WeakTopicsPanel";
import { TREND_RANGES, isTrendRange } from "@/features/dashboard/sample-data";

export const metadata = { title: "Home" };

/**
 * The dashboard — the screen that has to answer "what should I do today?"
 * before the student has to think about it.
 *
 * Layout follows the reference: a tall plan column, a middle stack of the two
 * charts over the wide readiness panel, and a right column of things that are
 * coming and things that are wrong. Below 1280px the three columns become one
 * stack in priority order — plan, then what is wrong, then the charts — because
 * on a phone the answer has to be the first thing, not the prettiest thing.
 *
 * Server Component. Only the plan's day toggle and the charts' hover layer are
 * client-side, and each is its own boundary.
 */
export default async function Page({ searchParams }: PageProps<"/dashboard">) {
  const params = await searchParams;
  const raw = Array.isArray(params.range) ? params.range[0] : params.range;
  const range = isTrendRange(raw) ? raw : "month";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Here is what will move your grades most today"
        title="Study dashboard"
        action={<SearchField placeholder="Search subjects, materials and topics" />}
        toolbar={
          <SegmentedNav aria-label="Progress range">
            {TREND_RANGES.map((option) => (
              <SegmentedNavItem
                key={option.value}
                href={`/dashboard?range=${option.value}`}
                current={range === option.value}
              >
                {option.label}
              </SegmentedNavItem>
            ))}
          </SegmentedNav>
        }
      />

      <SampleDataNotice sprint="Sprint 70" className="self-start" />

      <div className="grid gap-4 xl:grid-cols-[20rem_minmax(0,1fr)_21rem] xl:items-start">
        <PlanPanel className="xl:sticky xl:top-0 xl:max-h-[calc(100dvh-14rem)]" />

        <div className="flex min-w-0 flex-col gap-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <MasteryPanel />
            <TrendPanel range={range} />
          </div>
          <ReadinessPanel />
        </div>

        <div className="flex flex-col gap-4">
          <UpcomingPanel />
          <WeakTopicsPanel />
        </div>
      </div>
    </div>
  );
}
