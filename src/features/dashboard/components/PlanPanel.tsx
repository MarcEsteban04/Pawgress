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
 * 66, `PlanBlockRow`). Ticking blocks off writes `completed_at`, which is
 * Sprint 67; until then a rebuild is how the plan catches up with the day.
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
            <div className="flex items-baseline gap-2">
              <span className="tabular font-display text-2xl font-semibold">
                {minutesRemaining}m
              </span>
              <span className="text-sm text-ink-muted">
                left across {blocks.filter((b) => !b.done).length} blocks
              </span>
            </div>

            {rationale && <BuiltFrom rationale={rationale} />}

            <ul className="thin-scroll -mx-1 flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-1">
              {blocks.map((block) => (
                <li key={block.id}>
                  <PlanBlockRow block={block} />
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
