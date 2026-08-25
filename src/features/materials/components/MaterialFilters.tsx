"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Select } from "@/components/ui";
import { MATERIAL_SORTS, STATUS_FILTERS, type StatusFilter } from "@/features/materials/query";
import { KIND_LABELS } from "@/features/materials/upload";
import { type JobStatus, type MaterialKind } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Search, filter and sort the material library (FR-U4, US-C4).
 *
 * Same contract as the subject filters: **the URL is the state**, so a filtered
 * library is linkable, survives a reload, and unwinds with the back button.
 * `replace` rather than `push`, so typing six characters does not bury the
 * previous page under six history entries.
 *
 * Every control appears only when the data can answer it. A "PowerPoint" filter
 * over a library with no slides in it is a control that can only ever return
 * nothing, and a student who tries it learns the filters are decorative.
 */

/** Which status filters are worth offering, given what the library contains. */
function availableStatusFilters(statuses: JobStatus[]): StatusFilter[] {
  const has = (list: JobStatus[]) => list.some((status) => statuses.includes(status));
  const offered: StatusFilter[] = [];
  if (has(["ready"])) offered.push("ready");
  if (has(["queued", "uploading", "extracting", "embedding", "generating"]))
    offered.push("working");
  if (has(["failed", "cancelled", "over_quota"])) offered.push("failed");
  return offered;
}

export function MaterialFilters({
  kinds,
  statuses,
  topics,
}: {
  kinds: MaterialKind[];
  statuses: JobStatus[];
  topics: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const searchId = useId();
  const kindId = useId();
  const statusId = useId();
  const topicId = useId();
  const sortId = useId();

  const [search, setSearch] = useState(params.get("q") ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const statusOptions = availableStatusFilters(statuses);

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
        <span className="sr-only">Search files by name</span>
        <input
          id={searchId}
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search files"
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
        {kinds.length > 1 && (
          <>
            <label htmlFor={kindId} className="sr-only">
              Filter by file type
            </label>
            <Select
              id={kindId}
              value={params.get("kind") ?? ""}
              onChange={(event) => apply({ kind: event.target.value || null })}
              className="h-11 w-auto rounded-[var(--radius-pill)]"
            >
              <option value="">All types</option>
              {kinds.map((kind) => (
                <option key={kind} value={kind}>
                  {KIND_LABELS[kind]}
                </option>
              ))}
            </Select>
          </>
        )}

        {/* Offered only when there is more than one answer. With every file in
            the same state, a status filter sorts nothing into two piles. */}
        {statusOptions.length > 1 && (
          <>
            <label htmlFor={statusId} className="sr-only">
              Filter by status
            </label>
            <Select
              id={statusId}
              value={params.get("status") ?? ""}
              onChange={(event) => apply({ status: event.target.value || null })}
              className="h-11 w-auto rounded-[var(--radius-pill)]"
            >
              <option value="">Any status</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {STATUS_FILTERS[status]}
                </option>
              ))}
            </Select>
          </>
        )}

        {topics.length > 0 && (
          <>
            <label htmlFor={topicId} className="sr-only">
              Filter by topic
            </label>
            <Select
              id={topicId}
              value={params.get("topic") ?? ""}
              onChange={(event) => apply({ topic: event.target.value || null })}
              className="h-11 w-auto rounded-[var(--radius-pill)]"
            >
              <option value="">All topics</option>
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.name}
                </option>
              ))}
            </Select>
          </>
        )}

        <label htmlFor={sortId} className="sr-only">
          Sort files
        </label>
        <Select
          id={sortId}
          value={params.get("sort") ?? "recent"}
          onChange={(event) => apply({ sort: event.target.value })}
          className="h-11 w-auto rounded-[var(--radius-pill)]"
        >
          {Object.entries(MATERIAL_SORTS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
