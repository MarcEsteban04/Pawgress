import { CalendarCheck, Coffee, FileUp, PartyPopper } from "lucide-react";
import { Card, CardActions, CardBody, CardHeader, CardTitle } from "@/components/ui";
import { BuildPlanButton } from "@/features/plan/components/BuildPlanButton";
import { PlanBlockRow } from "@/features/plan/components/PlanBlockRow";
import { PanelEmpty } from "./PanelEmpty";
import { type PlanBlock } from "@/server/dashboard/queries";
import { type PlanRationale } from "@/server/plan/today";
import { cn } from "@/lib/utils";

/**
 * Today's study plan — the panel that answers "what should I do right now?".
 *
 * Every block states WHY it was chosen. A plan a student cannot interrogate is
 * an instruction to obey, and this product's claim is that it shows its
 * reasoning (docs/branding.md §1).
 *
 * Built by Sprint 65's engine (`features/plan/build.ts`) when the student
 * presses "Plan my day". Each block opens its activity in one click (Sprint
 * 66, `PlanBlockRow`), and is ticked off by hand or by finishing the work it
 * names (Sprint 67) — with the first unfinished block marked "Up next".
 *
 * **Under the minutes, what the plan was built from** — how many sessions came
 * from the student's own planner, how many from deadlines and weak topics, and
 * the time it had to work with. That is the plan explaining itself in figures
 * a student can check, rather than "recommended for you".
 */
export function PlanPanel({
  blocks,
  minutesRemaining,
  hasSubjects,
  plan,
  className,
}: {
  blocks: PlanBlock[];
  minutesRemaining: number;
  hasSubjects: boolean;
  plan: { built: boolean; rationale: PlanRationale | null };
  className?: string;
}) {
  const rationale = plan.rationale;
  /* Sprint 67: the first unfinished block, in the order the plan was written.
     Not the shortest or the easiest — the plan's order IS its advice. */
  const left = blocks.filter((block) => !block.done);
  const nextId = left[0]?.id ?? null;
  const totalMinutes = blocks.reduce((sum, block) => sum + block.minutes, 0);
  const doneMinutes = totalMinutes - minutesRemaining;

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader>
        <CardTitle>Study plan</CardTitle>
        {plan.built && (
          <CardActions>
            <BuildPlanButton built />
          </CardActions>
        )}
      </CardHeader>

      <CardBody className="flex min-h-0 flex-1 flex-col gap-4">
        {blocks.length === 0 ? (
          plan.built ? (
            <EmptyPlan rationale={rationale} />
          ) : (
            <PanelEmpty
              Icon={CalendarCheck}
              title="No plan for today yet"
              description={
                hasSubjects
                  ? "Built from your deadlines, weak topics and the time you have — and every block says why it is there."
                  : "Create a subject and upload something — a plan needs material to work from."
              }
              action={hasSubjects ? undefined : { href: "/subjects", label: "Create a subject" }}
              control={hasSubjects ? <BuildPlanButton built={false} /> : undefined}
            />
          )
        ) : (
          <>
            {left.length === 0 ? (
              /* Finished. Said in words, with the accent nowhere — celebration
                 is copy, never a character (docs/branding.md). */
              <div className="flex flex-col gap-1">
                <span className="font-display text-xl font-semibold">
                  Today&apos;s plan is done
                </span>
                <span className="text-sm text-ink-muted">
                  {totalMinutes} minutes across {blocks.length}{" "}
                  {blocks.length === 1 ? "block" : "blocks"}. Anything more today is extra.
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline gap-2">
                  <span className="tabular font-display text-2xl font-semibold">
                    {minutesRemaining}m
                  </span>
                  <span className="text-sm text-ink-muted">
                    left across {left.length} {left.length === 1 ? "block" : "blocks"}
                  </span>
                  <span className="ml-auto text-xs text-ink-subtle tabular-nums">
                    {blocks.length - left.length} of {blocks.length} done
                  </span>
                </div>
                {/* Minutes, not blocks: a 30-minute block done is more of the
                    day than a 10-minute one. Ink, not a mastery colour — this
                    is how much of the plan is behind you, not how good it was. */}
                <div
                  role="progressbar"
                  aria-label="Today's plan"
                  aria-valuemin={0}
                  aria-valuemax={totalMinutes}
                  aria-valuenow={doneMinutes}
                  className="h-1.5 overflow-hidden rounded-full bg-surface-sunken"
                >
                  <div
                    className="h-full rounded-full bg-ink transition-[width] duration-500"
                    style={{ width: `${totalMinutes ? (doneMinutes / totalMinutes) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}

            {rationale && <BuiltFrom rationale={rationale} />}

            <ul className="thin-scroll -mx-1 flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-1">
              {blocks.map((block) => (
                <li key={block.id}>
                  <PlanBlockRow block={block} next={block.id === nextId} />
                </li>
              ))}
            </ul>
          </>
        )}
      </CardBody>
    </Card>
  );
}

/**
 * What the plan was built from, in one line of figures.
 *
 * Zero counts are left out rather than printed — "0 from your planner" is a
 * sentence about nothing.
 */
function BuiltFrom({ rationale }: { rationale: PlanRationale }) {
  const sources = [
    rationale.fromPlanner > 0 && `${rationale.fromPlanner} from your planner`,
    rationale.forDeadlines > 0 &&
      `${rationale.forDeadlines} for ${rationale.forDeadlines === 1 ? "a deadline" : "deadlines"}`,
    rationale.forTopics > 0 &&
      `${rationale.forTopics} for ${rationale.forTopics === 1 ? "a weak topic" : "weak topics"}`,
    /* Sprint 68: how much of today was shaped by the last results. */
    (rationale.adapted ?? 0) > 0 && `${rationale.adapted} changed by recent results`,
  ].filter(Boolean);

  const time = `${rationale.perDay} × ${rationale.blockMinutes} min a day${
    rationale.studiedMinutes > 0 ? `, ${rationale.studiedMinutes} already studied` : ""
  }`;

  return (
    <div className="-mt-1 flex flex-col gap-1 text-xs text-ink-subtle">
      <p>
        {sources.length > 0 ? `${sources.join(" · ")} · ` : ""}
        {time}
      </p>
      {rationale.alsoToday.length > 0 && <p>Also today: {rationale.alsoToday.join(", ")}</p>}
      {rationale.leftOver > 0 && (
        <p>
          {rationale.leftOver === 1 ? "One more session" : `${rationale.leftOver} more sessions`}{" "}
          did not fit in today&apos;s time — the planner has the rest of the week.
        </p>
      )}
    </div>
  );
}

/**
 * A plan that was built and found nothing to do — said as what it is.
 *
 * US-J1: "with no data yet, the plan tells me what to do to get one instead of
 * inventing items". Each reason has its own next step, because "nothing to
 * plan" means something different to a student with no files than to one who
 * has already put in their hour.
 */
function EmptyPlan({ rationale }: { rationale: PlanRationale | null }) {
  switch (rationale?.empty) {
    case "no-subjects":
      return (
        <PanelEmpty
          Icon={CalendarCheck}
          title="Nothing to plan from yet"
          description="A plan is built from your subjects. Create one and upload your notes or slides."
          action={{ href: "/subjects", label: "Create a subject" }}
        />
      );
    case "no-material":
      return (
        <PanelEmpty
          Icon={FileUp}
          title="Upload something first"
          description="Reviewers, practice and flashcards are all made from your files, so a plan has nothing to point at until there are some."
          action={{ href: "/subjects", label: "Go to your subjects" }}
        />
      );
    case "time-used":
      return (
        <PanelEmpty
          Icon={Coffee}
          title="Today's time is used"
          description={`You have studied ${rationale.studiedMinutes} minutes today — the ${rationale.perDay} × ${rationale.blockMinutes} you set aside. Stopping is part of the plan.`}
        />
      );
    case "all-done":
      return (
        <PanelEmpty
          Icon={PartyPopper}
          title="Today's plan is done"
          description="Everything planned for today is finished. Tomorrow's sessions are in the planner."
          action={{ href: "/planner", label: "Open the planner" }}
        />
      );
    default:
      return (
        <PanelEmpty
          Icon={CalendarCheck}
          title="Nothing needs studying today"
          description="No deadline's run-up has started and no topic is flagged. Add an exam or deadline to the planner, or take a practice set so weak topics can be found."
          action={{ href: "/planner", label: "Open the planner" }}
        />
      );
  }
}
