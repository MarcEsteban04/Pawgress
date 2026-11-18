import { ArrowRight, Check, FolderPlus, Upload, Wand2 } from "lucide-react";
import Link from "next/link";
import { buttonStyles, Card, CardBody } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * The dashboard for an account with nothing in it yet (FR-D3, US-J3).
 *
 * **One action, not seven empty panels.** Before this, a new account saw the
 * whole dashboard with every panel saying some version of "nothing yet" — a
 * page that was mostly apology, with the one thing worth doing buried in the
 * first of them. US-J3: "a brand-new account sees a first-run version pointing
 * at one action: create a subject and upload something".
 *
 * **Two steps, shown as steps.** A subject, then a file in it. The step the
 * student is on carries the page's one accent button; a finished step is
 * ticked rather than hidden, so coming back after creating a subject reads as
 * progress rather than as a different page.
 *
 * What the dashboard becomes afterwards is said in one line, not drawn —
 * a preview of empty charts would be the sample-data dashboard again.
 */
export function FirstRun({
  subjectCount,
  firstSubjectId,
}: {
  subjectCount: number;
  /** Where "upload" goes once there is a subject to upload into. */
  firstSubjectId: string | null;
}) {
  const steps = [
    {
      done: subjectCount > 0,
      Icon: FolderPlus,
      title: "Create a subject",
      detail: "One per class you are taking — Biology, Calculus, whatever is on your timetable.",
      href: "/subjects",
      cta: "Create a subject",
    },
    {
      done: false,
      Icon: Upload,
      title: "Upload your notes or slides",
      detail:
        "PDFs, Word files, slides or photos of handwritten notes. Reviewers, practice questions and flashcards are all made from them.",
      href: firstSubjectId ? `/subjects/${firstSubjectId}/materials` : "/subjects",
      cta: "Upload a file",
    },
  ];
  const current = steps.findIndex((step) => !step.done);

  return (
    <Card>
      <CardBody className="flex flex-col gap-6 py-6 sm:py-8">
        <ol className="flex flex-col gap-4">
          {steps.map((step, index) => {
            const active = index === current;
            return (
              <li
                key={step.title}
                className={cn(
                  "flex items-start gap-4 rounded-[var(--radius-card)] p-4",
                  active ? "bg-surface-sunken" : "opacity-70",
                )}
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full border",
                    step.done ? "border-ok bg-ok text-on-ink" : "border-rule-strong bg-surface",
                  )}
                >
                  {step.done ? (
                    <Check className="size-4" aria-hidden />
                  ) : (
                    <step.Icon className="size-4 text-ink-muted" aria-hidden />
                  )}
                </span>

                <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
                  <p className="font-display text-lg leading-tight font-semibold">
                    <span className="sr-only">
                      Step {index + 1}
                      {step.done ? ", done" : ""}:{" "}
                    </span>
                    <span className={cn(step.done && "line-through decoration-ink-subtle")}>
                      {step.title}
                    </span>
                  </p>
                  <p className="max-w-[56ch] text-sm leading-relaxed text-ink-muted">
                    {step.detail}
                  </p>
                  {active && (
                    <Link href={step.href} className={buttonStyles({ variant: "accent" })}>
                      {step.cta}
                      <ArrowRight aria-hidden />
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        <p className="flex items-start gap-2 text-sm text-ink-muted">
          <Wand2 className="mt-0.5 size-4 shrink-0 text-ink-subtle" aria-hidden />
          After that, this page becomes a plan for each day — built from your exams, your weak
          topics and the time you have — with your readiness and what is coming up beside it.
        </p>
      </CardBody>
    </Card>
  );
}
