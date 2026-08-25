import { Pencil } from "lucide-react";
import Link from "next/link";
import { Button, Card, CardBody, Tag } from "@/components/ui";
import { DeleteSubjectDialog } from "./DeleteSubjectDialog";
import { SubjectDialog } from "./SubjectDialog";
import { SUBJECT_TONE, SubjectGlyph } from "./SubjectIcon";
import { type Subject } from "@/server/subjects/queries";
import { cn } from "@/lib/utils";

/** "3 days ago" beats a date a student has to subtract from today. */
function relative(iso: string): string {
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function SubjectCard({ subject }: { subject: Subject }) {
  const tone = SUBJECT_TONE[subject.colorSlot];

  return (
    <Card className="group flex h-full flex-col transition-colors hover:border-rule-strong">
      <CardBody className="flex flex-1 flex-col gap-4 pt-5">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-control)]",
              tone.tint,
              tone.ink,
            )}
          >
            <SubjectGlyph icon={subject.icon} className="size-5" />
          </span>

          <div className="min-w-0 flex-1">
            {/* A real link, so ctrl-click opens the subject in a new tab
                (docs/navigation.md §1). The hub itself is Sprint 23. */}
            <Link
              href={`/subjects/${subject.id}`}
              className="font-display text-lg leading-tight font-semibold hover:underline"
            >
              {subject.name}
            </Link>
            <p className="mt-1 text-sm text-ink-subtle">
              {subject.semester ? `${subject.semester} · ` : ""}
              {subject.materialCount > 0
                ? `active ${relative(subject.lastActivityAt)}`
                : `created ${relative(subject.createdAt)}`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Tag>
            {subject.materialCount} {subject.materialCount === 1 ? "file" : "files"}
          </Tag>
          <Tag>
            {subject.topicCount} {subject.topicCount === 1 ? "topic" : "topics"}
          </Tag>
        </div>

        <div className="mt-auto flex items-center gap-1 border-t border-rule pt-3">
          <SubjectDialog
            subject={subject}
            trigger={
              <Button variant="ghost" size="sm" aria-label={`Edit ${subject.name}`}>
                <Pencil aria-hidden />
              </Button>
            }
          />
          <DeleteSubjectDialog subjectId={subject.id} subjectName={subject.name} />
        </div>
      </CardBody>
    </Card>
  );
}
