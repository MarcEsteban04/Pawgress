"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Select } from "@/components/ui";
import { REVIEWER_SORTS } from "@/features/reviewers/query";
import { cn } from "@/lib/utils";

/**
 * Search, filter and sort the reviewer library (Sprint 47).
 *
 * Same contract as the material and subject filters: **the URL is the state**,
 * so a filtered library is linkable, survives a reload, and unwinds with the
 * back button. `replace` rather than `push`, so typing six characters does not
 * bury the previous page under six history entries.
 *
 * The subject filter appears only when reviewers exist in more than one subject.
 * With everything in one class it sorts nothing into two piles, and a control
 * that can only ever return the same list teaches a student the filters are
 * decorative.
 */
export function ReviewerFilters({ subjects }: { subjects: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const searchId = useId();
  const subjectId = useId();
  const sortId = useId();

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
        <span className="sr-only">Search reviewers by title</span>
        <input
          id={searchId}
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search reviewers"
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
        {subjects.length > 1 && (
          <>
            <label htmlFor={subjectId} className="sr-only">
              Filter by subject
            </label>
            <Select
              id={subjectId}
              value={params.get("subject") ?? ""}
              onChange={(event) => apply({ subject: event.target.value || null })}
              className="h-11 w-auto rounded-[var(--radius-pill)]"
            >
              <option value="">All subjects</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </Select>
          </>
        )}

        <label htmlFor={sortId} className="sr-only">
          Sort reviewers
        </label>
        <Select
          id={sortId}
          value={params.get("sort") ?? "recent"}
          onChange={(event) => apply({ sort: event.target.value || null })}
          className="h-11 w-auto rounded-[var(--radius-pill)]"
        >
          {Object.entries(REVIEWER_SORTS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
