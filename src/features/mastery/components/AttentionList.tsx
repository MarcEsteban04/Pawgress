import { CircleCheck } from "lucide-react";
import { type ReactNode } from "react";
import { type Attention } from "@/features/mastery/formula";
import { PractiseButton } from "@/features/mastery/components/PractiseButton";
import { SUBJECT_TONE } from "@/features/subjects/components/SubjectIcon";
import { type AttentionItem } from "@/server/mastery/queries";
import { cn, formatPercent } from "@/lib/utils";

/**
 * What to practise next, and why (FR-G3, US-H3, Sprint 59).
 *
 * **Every row says three things: what kind of problem, the evidence, and what
 * to do.** "Genetics 42%" — the roadmap's example — is the evidence alone. A
 * student reading it still has to decide what the number means and what to do
 * about it; the row decides for them, and shows its working so they can
 * disagree.
 *
 * **The kinds are named plainly and coloured by urgency, not by alarm.** Weak
 * is red because it is costing marks now. Slipping is amber because it will.
 * Stale and untested are neutral: nothing is wrong yet, and painting "you have
 * not tested this" red would make a student feel behind for having files.
 */

const KIND: Record<Attention["kind"], { label: string; tone: string; action: string }> = {
  weak: { label: "Weak", tone: "bg-bad-soft text-bad", action: "Practise" },
  slipping: { label: "Slipping", tone: "bg-warn-soft text-warn", action: "Practise" },
  stale: { label: "Due for review", tone: "bg-accent-soft text-accent", action: "Review" },
  untested: {
    label: "Not tested yet",
    tone: "bg-surface-sunken text-ink-muted",
    action: "Test yourself",
  },
};

const DIFFICULTY_WORD = { easy: "Easy", medium: "Medium", hard: "Hard" } as const;

export function AttentionList({
  items,
  showSubject = true,
  empty,
}: {
  items: AttentionItem[];
  /** Off inside a subject's own page, where naming the subject on every row is noise. */
  showSubject?: boolean;
  empty: ReactNode;
}) {
  if (items.length === 0) {
    return (
      <div className="flex items-start gap-2.5 text-sm leading-relaxed text-ink-muted">
        <CircleCheck className="mt-0.5 size-4 shrink-0 text-good" aria-hidden />
        <div>{empty}</div>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item) => {
        const kind = KIND[item.kind];
        const tone = SUBJECT_TONE[item.colorSlot];

        return (
          <li
            key={item.topicId}
            className="flex flex-col gap-3 rounded-[var(--radius-tile)] border border-rule bg-surface p-3.5 sm:flex-row sm:items-center"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span
                  className={cn(
                    "inline-flex rounded-[var(--radius-pill)] px-2 py-0.5 text-[0.6875rem] font-semibold tracking-[0.04em] uppercase",
                    kind.tone,
                  )}
                >
                  {kind.label}
                </span>
                <p className="min-w-0 truncate font-medium">{item.topicName}</p>
              </div>

              <p className="mt-1 text-xs text-ink-muted">
                {showSubject && (
                  <>
                    <span
                      className={cn(
                        "mr-1.5 inline-block size-1.5 rounded-full align-middle",
                        tone.dot,
                      )}
                    />
                    {item.subjectName} ·{" "}
                  </>
                )}
                {evidenceLine(item)}
              </p>

              {/* The pattern, when the evidence has one. It is what makes the
                  suggested difficulty a decision rather than a default. */}
              {item.pattern && (
                <p className="mt-1.5 text-xs leading-relaxed text-ink-subtle">
                  {item.pattern === "fundamentals"
                    ? "The easy questions are the ones being missed — start with the basics."
                    : "The basics are there; the harder questions are where it slips."}
                </p>
              )}
            </div>

            <PractiseButton
              subjectId={item.subjectId}
              topicId={item.topicId}
              difficulty={item.difficulty}
              label={`${kind.action} · ${DIFFICULTY_WORD[item.difficulty]}`}
            />
          </li>
        );
      })}
    </ul>
  );
}

/** The evidence behind the flag, in one line. */
function evidenceLine(item: AttentionItem): string {
  switch (item.kind) {
    case "weak":
      return `${formatPercent(item.mastery ?? 0)} from ${item.questions} questions`;
    case "slipping":
      return `${formatPercent(item.mastery ?? 0)} — down ${Math.round(Math.abs(item.improvement ?? 0) * 100)} points in two weeks`;
    case "stale":
      return `${formatPercent(item.mastery ?? 0)} · last practised ${item.daysSince} days ago`;
    case "untested":
      /* Honest about how much there is, because "not tested" after seven
         answers and after none are different situations. */
      return item.questions > 0
        ? `${item.questions} of 10 answers so far — not enough to score yet`
        : "You have files for it, and no answers yet";
  }
}
