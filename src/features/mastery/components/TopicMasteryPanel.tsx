import { ArrowDownRight, ArrowUpRight, Brain, Info } from "lucide-react";
import { Card, CardBody, MasteryBar } from "@/components/ui";
import {
  HALF_LIFE_DAYS,
  IMPROVEMENT_WINDOW_DAYS,
  LOW_EVIDENCE_QUESTIONS,
  STRONG_TOPIC_THRESHOLD,
  WEAK_TOPIC_THRESHOLD,
} from "@/features/mastery/formula";
import { type TopicMastery } from "@/server/progress/queries";

/**
 * Where a student is weak, where they are strong, and which way each is
 * moving (FR-P2, US-H1, Sprint 56).
 *
 * **Weak and strong side by side, not one ranked list.** A single list sorted
 * worst-first buries the strong topics at the bottom, and "what am I good at"
 * is the question that tells a student what they can stop revising — which is
 * how the time for the weak topics is found.
 *
 * **Movement is shown only when it is real.** A topic needs enough evidence
 * both now and a fortnight ago before an arrow appears, and a change under
 * five points is left unmarked. Otherwise the first week of anyone's revision
 * would be covered in green arrows that measure nothing but the arrival of
 * evidence.
 *
 * **The rules are on the page.** Mastery is a number a student will make
 * decisions from, and a number whose workings are hidden is one they cannot
 * argue with or trust. The explanation is one click away, in plain words.
 */
export function TopicMasteryPanel({ topics }: { topics: TopicMastery[] }) {
  const measured = topics.filter((topic) => topic.answered >= LOW_EVIDENCE_QUESTIONS);
  const weak = measured
    .filter((topic) => topic.band === "weak")
    .sort((a, b) => a.mastery - b.mastery)
    .slice(0, 6);
  const strong = measured
    .filter((topic) => topic.band === "strong")
    .sort((a, b) => b.mastery - a.mastery)
    .slice(0, 6);
  const developing = measured.filter((topic) => topic.band === "developing").length;
  const unmeasured = topics.length - measured.length;

  if (measured.length === 0) {
    return (
      <Card>
        <CardBody className="flex items-start gap-2.5 py-5 text-sm leading-relaxed text-ink-muted">
          <Brain className="mt-0.5 size-4 shrink-0 text-ink-subtle" aria-hidden />
          {topics.length === 0
            ? "Mastery is measured from the questions you answer in quizzes and practice sets. Take one and your topics start to appear here."
            : `Not enough answers yet — a topic needs ${LOW_EVIDENCE_QUESTIONS} different questions before its figure means anything, and ${topics.length === 1 ? "yours has" : "none of yours have"} reached that. Showing a number sooner would be guessing.`}
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <Column
          title="Needs work"
          blurb={`Below ${Math.round(WEAK_TOPIC_THRESHOLD * 100)}%, weakest first. Start here.`}
          topics={weak}
          empty="Nothing below the line. Every measured topic is holding up."
        />
        <Column
          title="Strong"
          blurb={`At ${Math.round(STRONG_TOPIC_THRESHOLD * 100)}% or above. You can spend less time here.`}
          topics={strong}
          empty="No topic is there yet. Keep practising the ones in the middle."
        />
      </div>

      <p className="text-xs text-ink-subtle">
        {developing > 0 &&
          `${developing} ${developing === 1 ? "topic is" : "topics are"} in between. `}
        {unmeasured > 0 &&
          `${unmeasured} ${unmeasured === 1 ? "topic has" : "topics have"} fewer than ${LOW_EVIDENCE_QUESTIONS} answers and ${unmeasured === 1 ? "is" : "are"} not scored yet.`}
      </p>

      {/* A native disclosure: no JavaScript, keyboard-operable, and it stays
          out of the way of someone who only wanted the lists. */}
      <details className="group rounded-[var(--radius-control)] border border-rule bg-surface px-4 py-3">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink">
          <Info className="size-4" aria-hidden />
          How mastery is worked out
        </summary>
        <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-ink-muted">
          <li>
            From questions you answer in quizzes and practice sets. Flashcards don&apos;t count —
            marking your own recall is a different kind of evidence.
          </li>
          <li>
            Each question counts once, using your most recent answer. Getting one right on the retry
            is where you are now.
          </li>
          <li>
            Recent answers count more: an answer loses half its weight every {HALF_LIFE_DAYS} days.
          </li>
          <li>
            A hard question right counts for more than an easy one. An easy question wrong counts
            for more than a hard one.
          </li>
          <li>
            A topic needs {LOW_EVIDENCE_QUESTIONS} different questions before it gets a figure.
            Arrows compare with {IMPROVEMENT_WINDOW_DAYS} days ago, once both ends had enough
            answers.
          </li>
        </ul>
      </details>
    </div>
  );
}

function Column({
  title,
  blurb,
  topics,
  empty,
}: {
  title: string;
  blurb: string;
  topics: TopicMastery[];
  empty: string;
}) {
  return (
    <Card>
      <CardBody className="flex flex-col gap-4 py-4">
        <div>
          <p className="font-display font-semibold">{title}</p>
          <p className="mt-0.5 text-xs text-ink-subtle">{blurb}</p>
        </div>

        {topics.length === 0 ? (
          <p className="text-sm text-ink-muted">{empty}</p>
        ) : (
          topics.map((topic) => (
            <div key={topic.id} className="flex items-end gap-3">
              <div className="min-w-0 flex-1">
                <MasteryBar
                  value={topic.mastery}
                  questionCount={topic.answered}
                  label={`${topic.topic} · ${topic.subject}`}
                />
              </div>
              <Movement change={topic.improvement} />
            </div>
          ))
        )}
      </CardBody>
    </Card>
  );
}

/** The fortnight's change, or nothing when there is nothing worth saying. */
function Movement({ change }: { change: number | null }) {
  if (change === null) return <span className="w-14 shrink-0" aria-hidden />;
  const points = Math.round(change * 100);
  if (Math.abs(points) < 5) return <span className="w-14 shrink-0" aria-hidden />;

  const up = points > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex w-14 shrink-0 items-center justify-end gap-0.5 pb-0.5 text-xs font-medium tabular-nums ${up ? "text-good" : "text-bad"}`}
      title={`${up ? "Up" : "Down"} ${Math.abs(points)} points in the last ${IMPROVEMENT_WINDOW_DAYS} days`}
    >
      <Icon className="size-3.5" aria-hidden />
      {up ? "+" : ""}
      {points}
    </span>
  );
}
