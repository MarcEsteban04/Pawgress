"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
  Field,
  Select,
} from "@/components/ui";
import { generateReviewerAction } from "@/features/reviewers/server/actions";

export type ReviewerTarget = {
  id: string;
  name: string;
  topics: { id: string; name: string }[];
};

/**
 * Start a reviewer from the library (FR-R1, US-F1).
 *
 * The library is not inside a subject, so the subject has to be asked for —
 * which is the whole reason this dialog exists and the subject page's button
 * did not need one. The topic follows from the subject and is optional: "the
 * whole subject" is the common case, and making someone choose a chapter before
 * they can have anything would be a question asked for the form's benefit.
 *
 * The topic list is reset by KEYING the select on the chosen subject rather
 * than by clearing it in an effect. The render that follows a subject change
 * already knows the topic is no longer valid.
 */
export function NewReviewerDialog({
  subjects,
  trigger,
}: {
  subjects: ReviewerTarget[];
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [topicId, setTopicId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const subjectFieldId = useId();
  const topicFieldId = useId();
  const subject = subjects.find((entry) => entry.id === subjectId);

  function generate() {
    if (!subjectId) return;
    setError(null);
    startTransition(async () => {
      const result = await generateReviewerAction({ subjectId, topicId: topicId || null });
      if (result.status === "error") {
        setError(`${result.message} ${result.nextStep}`);
        return;
      }
      router.push(`/subjects/${subjectId}/reviewers/${result.reviewerId}`);
    });
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="accent" disabled={subjects.length === 0}>
            <Sparkles aria-hidden />
            New reviewer
          </Button>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogTitle>New reviewer</DialogTitle>
        <DialogDescription>
          Aki reads everything you have filed here and writes a revision aid — a summary, the key
          concepts and terms, and what to revise first.
        </DialogDescription>

        <div className="mt-4 flex flex-col gap-4">
          <Field label="Subject" htmlFor={subjectFieldId}>
            <Select
              id={subjectFieldId}
              value={subjectId}
              onChange={(event) => {
                setSubjectId(event.target.value);
                setTopicId("");
              }}
            >
              {subjects.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Topic"
            htmlFor={topicFieldId}
            hint="Leave this on the whole subject unless you are revising one chapter."
          >
            <Select
              key={subjectId}
              id={topicFieldId}
              value={topicId}
              disabled={!subject?.topics.length}
              onChange={(event) => setTopicId(event.target.value)}
            >
              <option value="">Whole subject</option>
              {subject?.topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.name}
                </option>
              ))}
            </Select>
          </Field>

          {error && (
            <p role="alert" className="text-sm text-bad">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button variant="accent" onClick={generate} disabled={isPending || !subjectId}>
            <Sparkles aria-hidden />
            {isPending ? "Starting…" : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
