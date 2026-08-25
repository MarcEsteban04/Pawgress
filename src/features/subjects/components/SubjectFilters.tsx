"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Select } from "@/components/ui";
import { SUBJECT_SORTS } from "@/features/subjects/query";
import { cn } from "@/lib/utils";

/**
 * Search, sort and semester filter (FR-S2, US-B2).
 *
 * **The URL is the state.** A filtered list can be linked, reloaded, and moved
 * between tabs, and the back button undoes a search the way a student expects.
 * Holding it in component state would make all three stop working.
 *
 * `replace` rather than `push`, so typing six characters does not bury the
 * previous page under six history entries.
 *
 * The debounce is 250ms: long enough that a fast typist causes one query
 * instead of eight, short enough not to feel laggy. The pending flag drives a
 * spinner-free "searching" affordance — the list dims rather than disappearing,
 * because a list that vanishes mid-keystroke reads as "no results".
 */
export function SubjectFilters({ semesters }: { semesters: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const searchId = useId();
  const sortId = useId();
  const semesterId = useId();

  const [search, setSearch] = useState(params.get("q") ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function apply(next: Record<string, string | null>) {
    const query = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === "") query.delete(key);
      else query.set(key, value);
    }
    const qs = query.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  function onSearchChange(value: string) {
    setSearch(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => apply({ q: value.trim() || null }), 250);
  }

  // A pending debounce must not outlive the component.
  useEffect(() => () => (timer.current ? clearTimeout(timer.current) : undefined), []);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center",
        isPending && "opacity-70 transition-opacity",
      )}
    >
      <label
        htmlFor={searchId}
        className="group flex h-11 flex-1 items-center gap-2.5 rounded-[var(--radius-pill)] border border-rule bg-surface px-4 transition-colors focus-within:border-rule-strong hover:border-rule-strong"
      >
        <Search className="size-[1.125rem] shrink-0 text-ink-subtle" aria-hidden />
        <span className="sr-only">Search subjects by name</span>
        <input
          id={searchId}
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search subjects"
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-subtle"
        />
        {search && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setSearch("");
              apply({ q: null });
            }}
            className="shrink-0 rounded-full p-1 text-ink-subtle transition-colors hover:text-ink"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </label>

      <div className="flex gap-3">
        {/* Only offered when there is something to filter by. An empty dropdown
            is a control that does nothing. */}
        {semesters.length > 0 && (
          <>
            <label htmlFor={semesterId} className="sr-only">
              Filter by semester
            </label>
            <Select
              id={semesterId}
              value={params.get("semester") ?? ""}
              onChange={(event) => apply({ semester: event.target.value || null })}
              className="h-11 w-auto rounded-[var(--radius-pill)]"
            >
              <option value="">All semesters</option>
              {semesters.map((semester) => (
                <option key={semester} value={semester}>
                  {semester}
                </option>
              ))}
            </Select>
          </>
        )}

        <label htmlFor={sortId} className="sr-only">
          Sort subjects
        </label>
        <Select
          id={sortId}
          value={params.get("sort") ?? "activity"}
          onChange={(event) => apply({ sort: event.target.value })}
          className="h-11 w-auto rounded-[var(--radius-pill)]"
        >
          {Object.entries(SUBJECT_SORTS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
