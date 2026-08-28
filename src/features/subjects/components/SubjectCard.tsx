import { ArrowRight, Pencil } from "lucide-react";
import Link from "next/link";
import { Button, Card, CardBody } from "@/components/ui";
import { ArchiveSubjectButton } from "./ArchiveSubjectButton";
import { DeleteSubjectDialog } from "./DeleteSubjectDialog";
import { SubjectDialog } from "./SubjectDialog";
import { SUBJECT_TONE, SubjectGlyph } from "./SubjectIcon";
import { type Subject } from "@/server/subjects/queries";
import { formatAcademicYear } from "@/lib/validation/subject";
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
 * Three decisions carry this design, and two of them are deletions:
 *
 *  1. **The hue blooms from one corner rather than flooding the card.** A flat
 *     tint makes every card equally loud and pushes the text onto a coloured
 *     ground; a radial wash concentrated behind the glyph says the same thing
 *     and leaves the lower half clean paper for the numbers to sit on.
 *  2. **The small icon chip is gone.** The oversized glyph behind the corner
 *     already names the subject, and a card carrying the same icon twice is
 *     decoration pretending to be information. Removing it also gives the
 *     title the full width, which is what a student actually reads.
 *  3. **The count pills are gone**, replaced by the figures themselves at
 *     display size. "12 files" as a grey pill is a label; a large tabular 12
 *     over a small FILES is a number — and numbers are what this card is for.
 *
 * An archived subject (US-B6) keeps its card and its numbers — the whole
 * point is that the data stays readable — but drops the colour and the hover
 * lift. It is out of the way, not gone, and it should not compete with the
 * classes a student is actually taking.
 *
 * The whole card is a stretched link: one real `<a>` on the title with an
 * `::after` covering the card. Ctrl-click and "open in new tab" keep working,
 * the destination shows in the status bar, and there is still exactly one tab
 * stop. Edit and delete get their own stacking context so they stay separately
 * clickable, and they fade in on hover on pointer devices while staying
 * permanently visible under `md`, where there is no hover to reveal them.
 */
export function SubjectCard({ subject }: { subject: Subject }) {
  const tone = SUBJECT_TONE[subject.colorSlot];
  const archived = subject.archivedAt !== null;

  return (
    <Card
      className={cn(
        "group relative flex h-full flex-col overflow-hidden",
        "transition-[transform,box-shadow,border-color] duration-200 ease-out",
        archived
          ? "hover:border-rule-strong"
          : /* Two things move on hover and both are small: a 3px rise and the
             shadow that explains it. Anything larger reads as the card
             jumping away from the cursor rather than towards it. */
            "hover:-translate-y-[3px] hover:border-rule-strong hover:shadow-float",
        /* Focus lands on the card, because the card is what the link covers.
           Same outline token and offset as the global `:focus-visible` rule in
           globals.css — the one focus treatment relocated, not a second one. */
        "has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-(--focus)",
      )}
    >
      {/* Decorative layers. `pointer-events-none` so they never intercept a
          click meant for the link overlay, and no z-index: they sit after the
          card's background and before its content simply by document order. */}
      {!archived && (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 transition-opacity duration-300 group-hover:opacity-90"
            style={{
              background: `radial-gradient(115% 85% at 100% 0%, ${tone.soft} 0%, transparent 66%)`,
            }}
          />
          {/* A one-pixel sheen along the top edge, in the subject own hue.
              It is what makes the card read as a lit object rather than a
              rectangle with a colour in it — the same trick as a bevel, at a
              tenth the weight. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-40"
            style={{
              background: `linear-gradient(90deg, transparent, ${tone.hue}, transparent)`,
            }}
          />
        </>
      )}

      {/* The subject's icon at display size, bleeding off the corner. At 8%
          it is texture rather than an icon — enough to give each card its own
          character without competing with a single word of the title. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute -top-4 -right-4 transition-transform duration-300 ease-out",
          archived ? "opacity-[0.05]" : "opacity-[0.08] group-hover:scale-110",
        )}
        style={{ color: archived ? "var(--ink-subtle)" : tone.hue }}
      >
        <SubjectGlyph icon={subject.icon} className="size-32" />
      </span>

      {/* The hue at full strength. The wash alone cannot be trusted to identify
          a subject — the soft tokens are close enough that peripheral vision
          cannot separate them — so one saturated edge does the identifying. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-1 transition-[width] duration-200 ease-out",
          !archived && "group-hover:w-1.5",
        )}
        style={{
          background: archived
            ? "var(--rule-strong)"
            : `linear-gradient(180deg, ${tone.hue}, color-mix(in oklab, ${tone.hue} 55%, transparent))`,
        }}
      />

      <CardBody className="relative flex flex-1 flex-col gap-5 pt-5">
        <div className="min-w-0">
          <Link
            href={`/subjects/${subject.id}`}
            className="line-clamp-2 font-display text-xl leading-tight font-semibold tracking-[-0.01em] outline-none after:absolute after:inset-0 after:content-['']"
          >
            {subject.name}
          </Link>
          <p className="mt-1.5 text-sm text-ink-subtle">
            {[
              subject.academicYear !== null ? formatAcademicYear(subject.academicYear) : null,
              subject.semester,
              archived
                ? `archived ${relative(subject.archivedAt!)}`
                : subject.materialCount > 0
                  ? `active ${relative(subject.lastActivityAt)}`
                  : `created ${relative(subject.createdAt)}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>

        {/* Divided by a hairline rather than spaced apart. Two numbers side by
            side with only whitespace between them read as one number that has
            been split; a rule says they are separate measures. */}
        <dl className="flex items-stretch">
          <div className="pr-6">
            <dd className="tabular font-display text-[1.875rem] leading-none font-semibold tracking-[-0.02em]">
              {subject.materialCount}
            </dd>
            <dt className="mt-2 text-[0.6875rem] font-medium tracking-[0.09em] text-ink-subtle uppercase">
              {subject.materialCount === 1 ? "File" : "Files"}
            </dt>
          </div>
          <div className="border-l border-rule pl-6">
            <dd className="tabular font-display text-[1.875rem] leading-none font-semibold tracking-[-0.02em]">
              {subject.topicCount}
            </dd>
            <dt className="mt-2 text-[0.6875rem] font-medium tracking-[0.09em] text-ink-subtle uppercase">
              {subject.topicCount === 1 ? "Topic" : "Topics"}
            </dt>
          </div>
        </dl>

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-rule pt-3">
          {/* Deliberately a span, not a link. It is the affordance that says
              the card opens — making it a second <a> to the same place would
              add a tab stop that goes nowhere new. */}
          <span className="flex items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors group-hover:text-ink">
            {archived ? "Archived" : "Open"}
            <ArrowRight
              className="size-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5"
              aria-hidden
            />
          </span>

          {/* `relative` lifts these above the stretched link's overlay —
              without it every click here opens the subject instead. Hidden
              until hover only where hover exists; on touch they are always on,
              and focus reveals them for keyboard users. */}
          <div className="relative flex items-center gap-1 transition-opacity duration-200 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
            {/* Editing an archived subject is a strange thing to want, and
                offering it invites a student to tidy the archive instead of
                studying. Restore first, then edit. */}
            {!archived && (
              <SubjectDialog
                subject={subject}
                trigger={
                  <Button variant="ghost" size="sm" aria-label={`Edit ${subject.name}`}>
                    <Pencil aria-hidden />
                  </Button>
                }
              />
            )}
            <ArchiveSubjectButton
              subjectId={subject.id}
              subjectName={subject.name}
              archived={archived}
            />
            <DeleteSubjectDialog subjectId={subject.id} subjectName={subject.name} />
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
