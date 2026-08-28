import { Skeleton } from "@/components/ui";

/**
 * Shaped like the cards it replaces, so nothing shifts when they arrive
 * (US-B2: "loads with skeletons, never a blank screen").
 *
 * Three, not one: a single skeleton implies a single result and makes a full
 * grid appear to jump in from nowhere.
 */
export function SubjectListSkeleton() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" aria-hidden>
      {[0, 1, 2].map((i) => (
        <li key={i}>
          <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-rule bg-surface p-5">
            <div className="flex gap-3">
              <Skeleton className="size-11 rounded-[var(--radius-control)]" />
              <div className="flex flex-1 flex-col gap-2 pt-1">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-6 w-16 rounded-[var(--radius-pill)]" />
              <Skeleton className="h-6 w-20 rounded-[var(--radius-pill)]" />
            </div>
            <Skeleton className="mt-2 h-9 w-24" />
          </div>
        </li>
      ))}
    </ul>
  );
}
