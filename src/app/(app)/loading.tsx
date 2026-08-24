import { Skeleton } from "@/components/ui";

/**
 * Shell-level loading UI, streamed while a route segment resolves.
 *
 * Skeletons mirror the dashboard's three-column layout rather than a generic
 * grid, so the page does not reflow the moment real content arrives
 * (docs/states.md §1).
 */
export default function AppLoading() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-9 w-64" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[20rem_minmax(0,1fr)_21rem] xl:items-start">
        <Skeleton className="h-[28rem] rounded-[var(--radius-card)]" />
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-60 rounded-[var(--radius-card)]" />
            <Skeleton className="h-60 rounded-[var(--radius-card)]" />
          </div>
          <Skeleton className="h-64 rounded-[var(--radius-card)]" />
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-64 rounded-[var(--radius-card)]" />
          <Skeleton className="h-64 rounded-[var(--radius-card)]" />
        </div>
      </div>
    </div>
  );
}
