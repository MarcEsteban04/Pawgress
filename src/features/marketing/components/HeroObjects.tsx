import { Check, FileText, Presentation, ScanText } from "lucide-react";
import { MasteryBar, SourceChip, StatusBadge } from "@/components/ui";
import { CITATION, NEXT_EXAM_LANDING, PLAN_TODAY, STICKY_NOTE } from "@/config/showcase";
import { Stopwatch } from "./Stopwatch";
import { cn } from "@/lib/utils";

/**
 * The objects scattered around the landing hero.
 *
 * Every one of them is a real product surface, not an illustration of one: the
 * bars are `MasteryBar` with its real low-evidence rule, the status is
 * `StatusBadge` from the shared job vocabulary, the citation is `SourceChip`.
 * If a token or a rule is wrong, the marketing page breaks in the same way the
 * app does — which is the only way a hero image stays honest as the product
 * changes underneath it.
 *
 * Each object is a plain block here. Placement is `HeroDecor`'s job, so these
 * stay reusable at other sizes and in the stacked mobile layout.
 */

/** Shared object chrome: white card, hairline, and the three-layer float. */
const OBJECT = "rounded-[1.25rem] border border-rule bg-surface shadow-[var(--shadow-float)]";

/**
 * A pinned paper note — the messy input side of the product.
 * Deliberately the only handwriting in the entire system.
 */
export function StickyNote({ className }: { className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <div className="absolute -top-2 left-1/2 z-10 size-4 -translate-x-1/2 rounded-full bg-bad shadow-[var(--shadow-pill)]" />
      <div
        className="w-[13.5rem] rounded-[0.25rem] px-5 py-5 shadow-[var(--shadow-float)]"
        style={{ backgroundColor: "#fbf0a4" }}
      >
        <p className="font-hand text-[1.0625rem] leading-[1.45]" style={{ color: "#4a4526" }}>
          {STICKY_NOTE}
        </p>
      </div>
    </div>
  );
}

/** The blue tick tile that sits under the note. */
export function CheckTile({ className }: { className?: string }) {
  return (
    <div className={cn(OBJECT, "flex size-16 items-center justify-center", className)}>
      <span className="flex size-10 items-center justify-center rounded-[0.75rem] bg-accent text-on-accent shadow-[var(--shadow-pill)]">
        <Check className="size-6" strokeWidth={3} aria-hidden />
      </span>
    </div>
  );
}

/** Today's plan — the output side: three blocks, with evidence attached. */
export function PlanCard({ className }: { className?: string }) {
  // A block per topic, so the headline figure cannot drift from the rows below
  // it the way a hardcoded "95m" did.
  const totalMinutes = PLAN_TODAY.length * 30;

  return (
    <div className={cn(OBJECT, "w-[21rem] p-5", className)}>
      <div className="flex items-baseline gap-2">
        <h3 className="font-display text-[1.0625rem] font-semibold">Today&rsquo;s plan</h3>
        <span className="tabular ml-auto text-sm text-ink-subtle">{totalMinutes}m</span>
      </div>

      <ul className="mt-4 flex flex-col gap-3.5">
        {PLAN_TODAY.map((row) => (
          <li key={row.topic} className="flex flex-col gap-1">
            <span className="text-xs text-ink-subtle">{row.subject}</span>
            <MasteryBar
              dense
              hideEvidence
              label={row.topic}
              tone={row.tone}
              value={row.value}
              questionCount={row.questionCount}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Subject tints, keyed by the categorical slot a subject owns for life. */
const TINT = {
  1: "bg-cat-1-soft",
  2: "bg-cat-2-soft",
  3: "bg-cat-3-soft",
  4: "bg-cat-4-soft",
  5: "bg-cat-5-soft",
} as const;

/** The exam countdown, with a readiness figure that carries its evidence. */
export function ReminderCard({ className }: { className?: string }) {
  const exam = NEXT_EXAM_LANDING;

  return (
    <div className={cn(OBJECT, "w-[16rem] p-5", className)}>
      <h3 className="font-display text-[1.0625rem] font-semibold">Next exam</h3>

      <div className={cn("mt-3 rounded-[1rem] p-3.5", TINT[exam.tone])}>
        <p className="text-xs font-medium text-ink-muted">{exam.subject}</p>
        <p className="mt-0.5 leading-snug font-medium">{exam.title}</p>
        <p className="tabular mt-2 text-sm font-medium">In {exam.inDays} days</p>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs text-ink-muted">
          <span className="tabular font-medium text-ink">{Math.round(exam.readiness * 100)}%</span>{" "}
          ready
        </span>
        <StatusBadge status="ready" />
      </div>
    </div>
  );
}

/** What a student can actually hand over. */
export function FormatsCard({ className }: { className?: string }) {
  const formats = [
    { Icon: FileText, label: "PDF", tone: "bg-cat-2-soft text-cat-2" },
    { Icon: Presentation, label: "PPTX", tone: "bg-cat-5-soft text-cat-5" },
    { Icon: ScanText, label: "DOCX", tone: "bg-cat-3-soft text-cat-3" },
  ];

  return (
    <div className={cn(OBJECT, "w-[18.5rem] p-5", className)}>
      <h3 className="font-display text-[1.0625rem] font-semibold">
        Whatever your teacher gave you
      </h3>

      <div className="mt-4 flex items-center gap-3">
        {formats.map(({ Icon, label, tone }) => (
          <div
            key={label}
            className="flex flex-1 flex-col items-center gap-2 rounded-[1rem] border border-rule bg-surface py-3.5"
          >
            <span
              className={cn("flex size-10 items-center justify-center rounded-[0.75rem]", tone)}
            >
              <Icon className="size-5" aria-hidden />
            </span>
            <span className="text-xs font-medium text-ink-muted">{label}</span>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <SourceChip material={CITATION.material} page={CITATION.page} />
      </div>
    </div>
  );
}

export { Stopwatch };
