"use client";

import { Archive, Search, Undo2, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Select } from "@/components/ui";
import { SUBJECT_GROUPS, SUBJECT_SORTS } from "@/features/subjects/query";
import { formatAcademicYear } from "@/lib/validation/subject";
import { cn } from "@/lib/utils";

/**
 * Search, grouping, sorting and filtering (FR-S2, FR-S6, US-B2, US-B6).
 *
 * **The URL is the state.** A filtered list can be linked, reloaded, and moved
 * between tabs, and the back button undoes a search the way a student expects.
 * Holding it in component state would make all three stop working.
 *
 * `replace` rather than `push`, so typing six characters does not bury the
 * previous page under six history entries.
 *
 * The debounce is 250ms: long enough that a fast typist causes one query
 * instead of eight, short enough not to feel laggy. The pending flag dims the
 * row rather than emptying it — a list that vanishes mid-keystroke reads as
 * "no results".
 *
 * Every control appears only when the data can answer it. A semester dropdown
 * over subjects that have no semester is a control that can only ever return
 * nothing.
 */
export function SubjectFilters({
  semesters,
  years,
  archivedCount,
  archived,
}: {
  semesters: string[];
  years: number[];
  archivedCount: number;
  archived: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const searchId = useId();
  const sortId = useId();
  const groupId = useId();
  const semesterId = useId();
  const yearId = useId();

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
    <div className={cn("flex flex-col gap-3", isPending && "opacity-70 transition-opacity")}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
            placeholder={archived ? "Search archived subjects" : "Search subjects"}
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

        <div className="flex flex-wrap gap-3">
          {years.length > 0 && (
            <>
              <label htmlFor={yearId} className="sr-only">
                Filter by academic year
              </label>
              <Select
                id={yearId}
                value={params.get("year") ?? ""}
                onChange={(event) => apply({ year: event.target.value || null })}
                className="h-11 w-auto rounded-[var(--radius-pill)]"
              >
                <option value="">All years</option>
                {years.map((year) => (
                  <option key={year} value={year}>
                    {formatAcademicYear(year)}
                  </option>
                ))}
              </Select>
            </>
          )}

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

          {(years.length > 0 || semesters.length > 0) && (
            <>
              <label htmlFor={groupId} className="sr-only">
                Group subjects
              </label>
              <Select
                id={groupId}
                value={params.get("group") ?? "none"}
                onChange={(event) => apply({ group: event.target.value })}
                className="h-11 w-auto rounded-[var(--radius-pill)]"
              >
                {Object.entries(SUBJECT_GROUPS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
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

      {/* The way into and out of the archive. A link rather than a toggle
          button: it swaps which set of subjects the page is showing, which is
          navigation — so it should be linkable, and Back should undo it.
          Offered only once something has been archived; an empty archive is a
          door to an empty room. */}
      {(archivedCount > 0 || archived) && (
        <Link
          href={archived ? "/subjects" : "/subjects?archived=1"}
          className="inline-flex w-fit items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink"
        >
          {archived ? (
            <>
              <Undo2 className="size-4" aria-hidden />
              Back to active subjects
            </>
          ) : (
            <>
              <Archive className="size-4" aria-hidden />
              {archivedCount} archived
            </>
          )}
        </Link>
      )}
    </div>
  );
}
