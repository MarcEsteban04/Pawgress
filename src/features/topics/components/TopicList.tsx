import { Pencil } from "lucide-react";
import { Button, Card, CardBody, MasteryBar, Tag } from "@/components/ui";
import { DeleteTopicDialog } from "./DeleteTopicDialog";
import { TopicDialog } from "./TopicDialog";
import { type Topic } from "@/server/topics/queries";

/**
 * The topics inside one subject (FR-S3, US-B4).
 *
 * Each row shows mastery, and until a quiz has been taken that mastery is
 * genuinely unknown — `MasteryBar` renders the striped low-evidence state and
 * says "not enough data yet" rather than drawing a confident 0%. That is the
 * honest reading, not a placeholder: the number arrives when quizzes do
 * (Sprint 49 onwards, FR-G1), and until then the bar's job is to show a student
 * where the gaps in their *evidence* are.
 *
 * A plain list rather than a grid. Topics are read down a syllabus in order,
 * they have one attribute each, and the ordering is meaningful — none of which
 * a grid of cards respects.
 */
export function TopicList({ subjectId, topics }: { subjectId: string; topics: Topic[] }) {
  return (
    <Card>
      <CardBody className="p-0">
        <ul className="divide-y divide-rule">
          {topics.map((topic) => (
            <li
              key={topic.id}
              className="flex flex-col gap-3 p-4 transition-colors hover:bg-surface-sunken sm:flex-row sm:items-center sm:gap-5 sm:px-5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{topic.name}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <Tag>
                    {topic.materialCount} {topic.materialCount === 1 ? "file" : "files"}
                  </Tag>
                </div>
              </div>

              <div className="w-full shrink-0 sm:w-52">
                <MasteryBar
                  value={topic.mastery}
                  questionCount={topic.questionsAnswered}
                  dense
                  hideEvidence
                />
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <TopicDialog
                  subjectId={subjectId}
                  topic={topic}
                  trigger={
                    <Button variant="ghost" size="sm" aria-label={`Rename ${topic.name}`}>
                      <Pencil aria-hidden />
                    </Button>
                  }
                />
                <DeleteTopicDialog topicId={topic.id} topicName={topic.name} />
              </div>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
