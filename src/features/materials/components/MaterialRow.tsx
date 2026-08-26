"use client";

import { FileImage, FileText, Presentation, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { Select, StatusBadge, Tag } from "@/components/ui";
import {
  DeleteMaterialDialog,
  RenameMaterialDialog,
} from "@/features/materials/components/MaterialActions";
import { setMaterialTopicAction } from "@/features/materials/server/actions";
import { formatBytes, KIND_LABELS } from "@/features/materials/upload";
import { type Material } from "@/server/materials/queries";
import { type MaterialKind } from "@/types";
import { cn } from "@/lib/utils";

/**
 * One file in the library (FR-U4, US-C4).
 *
 * Name, type, size, upload date, topic and processing status — the six things
 * US-C4 names, because a library that shows only names makes a student open
 * files to find out what they are.
 *
 * The title links to the file's own page (Sprint 29), where it can be previewed.
 * Rename and delete live in `MaterialActions.tsx` because that page needs the
 * same two dialogs, and two dialogs that delete the same thing will drift.
 */

const KIND_ICONS: Record<MaterialKind, typeof FileText> = {
  pdf: FileText,
  docx: FileText,
  pptx: Presentation,
  image: FileImage,
  note: FileText,
};

/** "3 days ago" beats a date a student has to subtract from today. */
function relative(iso: string): string {
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function MaterialRow({
  material,
  topics,
}: {
  material: Material;
  topics: { id: string; name: string }[];
}) {
  const Icon = KIND_ICONS[material.kind];
  const [isMoving, startMoving] = useTransition();
  const [moveError, setMoveError] = useState<string | null>(null);
  const topicSelectId = useId();

  function moveToTopic(next: string) {
    setMoveError(null);
    startMoving(async () => {
      const result = await setMaterialTopicAction(material.id, next || null);
      if (result.status === "error") setMoveError(result.message ?? "That did not save.");
    });
  }

  return (
    <li className="flex flex-col gap-3 p-4 transition-colors hover:bg-surface-sunken sm:flex-row sm:items-center sm:gap-4 sm:px-5">
      <Icon className="hidden size-4 shrink-0 text-ink-subtle sm:block" aria-hidden />

      <div className="min-w-0 flex-1">
        {/* A real link, so ctrl-click opens the file in its own tab — students
            keep a lecture open beside their notes (docs/navigation.md §1). */}
        <Link
          href={`/subjects/${material.subjectId}/materials/${material.id}`}
          className="block truncate font-medium underline decoration-transparent underline-offset-2 transition-colors hover:decoration-rule-strong"
        >
          {material.title}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-subtle">
          <span>{KIND_LABELS[material.kind]}</span>
          {material.byteSize !== null && (
            <>
              <span aria-hidden>·</span>
              <span className="tabular">{formatBytes(material.byteSize)}</span>
            </>
          )}
          {material.pageCount !== null && (
            <>
              <span aria-hidden>·</span>
              <span className="tabular">{material.pageCount} pages</span>
            </>
          )}
          <span aria-hidden>·</span>
          <span>{relative(material.createdAt)}</span>
        </div>

        {/* A failure states the stage AND what to do, never just "failed"
            (docs/states.md §5). */}
        {material.failureMessage && (
          <p className="mt-1.5 flex items-start gap-1.5 text-xs text-bad">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              {material.failureMessage} {material.failureNextStep}
            </span>
          </p>
        )}

        {moveError && (
          <p role="alert" className="mt-1.5 text-xs text-bad">
            {moveError}
          </p>
        )}
      </div>

      {/* Re-filing from the library, because the topic a file belongs to is the
          thing students most often get wrong at upload time — it did not exist
          yet, or the file turned out to be about something else. */}
      {topics.length > 0 ? (
        <div className="shrink-0 sm:w-44">
          <label htmlFor={topicSelectId} className="sr-only">
            Topic for {material.title}
          </label>
          <Select
            id={topicSelectId}
            value={material.topicId ?? ""}
            disabled={isMoving}
            onChange={(event) => moveToTopic(event.target.value)}
            className={cn("h-9 text-sm", isMoving && "opacity-70")}
          >
            <option value="">No topic</option>
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.name}
              </option>
            ))}
          </Select>
        </div>
      ) : (
        material.topicName && <Tag className="shrink-0">{material.topicName}</Tag>
      )}

      <div className="flex shrink-0 items-center gap-1">
        <StatusBadge status={material.status} />
        <RenameMaterialDialog material={material} />
        <DeleteMaterialDialog material={material} />
      </div>
    </li>
  );
}
