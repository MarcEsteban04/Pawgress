import { SegmentedNav, SegmentedNavItem } from "@/components/ui";
import { TREND_RANGES, isTrendRange } from "@/features/dashboard/sample-data";

/**
 * The dashboard's range switcher, rendered into the shell's top bar.
 *
 * This is a parallel route slot rather than a prop threaded down through the
 * layout, because the layout must not have to know which page is underneath it.
 * The slot owns the control; the page owns the content; neither imports the
 * other (docs/architecture.md §2).
 *
 * The options are real links writing `?range=` to the URL, so a range is
 * shareable, survives reload, and needs no client JavaScript.
 */
export default async function DashboardToolbar({ searchParams }: PageProps<"/dashboard">) {
  const params = await searchParams;
  const raw = Array.isArray(params.range) ? params.range[0] : params.range;
  const range = isTrendRange(raw) ? raw : "month";

  return (
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
      <SegmentedNavItem href="/progress">Reports</SegmentedNavItem>
    </SegmentedNav>
  );
}
