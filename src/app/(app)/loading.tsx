import { Skeleton } from "@/components/ui";

/**
 * Shell-level loading UI, streamed while a route segment resolves.
 *
 * Skeletons mirror the layout they replace — a page header, then a two-column
 * card grid — so nothing jumps when the real content arrives (docs/states.md §1).
 */
export default function AppLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Skeleton className="h-44 rounded-[var(--radius-card)]" />
        <Skeleton className="h-44 rounded-[var(--radius-card)]" />
        <Skeleton className="h-32 rounded-[var(--radius-card)]" />
        <Skeleton className="h-32 rounded-[var(--radius-card)]" />
      </div>
    </div>
  );
}
