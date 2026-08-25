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

/**
 * One subject in the list (FR-S2, US-B2).
 *
 * **The whole card opens the subject.** It is done with a stretched link — one
 * real `<a>` around the title, with an `::after` overlaying the card — rather
 * than an `onClick` on a `<div>`. That distinction is the point:
 *
 *  - It stays a link. Ctrl-click, middle-click and "open in new tab" work, the
 *    browser shows the destination in the status bar, and it is announced as a
 *    link rather than as a div that happens to respond to clicks.
 *  - There is exactly ONE tab stop for "open this subject", on the title —
 *    not one for the card and another for the text inside it.
 *  - Edit and delete sit above the overlay in their own stacking context, so
 *    they stay separately clickable instead of being swallowed by it.
 *
 * The known cost is that text inside the card can no longer be selected with
 * the mouse. For a card whose text is a name and two counts, clicking the
 * obvious target matters more than selecting four words.
 */
export function SubjectCard({ subject }: { subject: Subject }) {
  const tone = SUBJECT_TONE[subject.colorSlot];

  return (
    <Card
      className={cn(
        "group relative flex h-full flex-col transition-colors",
        "hover:border-rule-strong",
        /* Focus moves to the card, because the card is what the link now
           covers — outlining four words of title would point at the wrong
           target. Same outline token and offset as the global `:focus-visible`
           rule in globals.css, so this is the one focus treatment relocated,
           not a second one invented. */
        "has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-(--focus)",
      )}
    >
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
            <Link
              href={`/subjects/${subject.id}`}
              className="font-display text-lg leading-tight font-semibold outline-none group-hover:underline after:absolute after:inset-0 after:content-['']"
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

        {/* `relative` lifts this row above the stretched link's overlay.
            Without it the buttons sit under a transparent sheet and every
            click on them opens the subject instead. */}
        <div className="relative mt-auto flex items-center gap-1 border-t border-rule pt-3">
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
