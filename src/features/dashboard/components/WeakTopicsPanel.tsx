import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui";
import { AttentionList } from "@/features/mastery/components/AttentionList";
import { type AttentionItem } from "@/server/mastery/queries";

/**
 * What to practise next, across every subject (Sprint 59).
 *
 * This panel used to list topics under 60% and link each to the subject list —
 * the one place that did not help, since the student then had to find the
 * topic again and decide what "study this" meant. It now carries every reason
 * a topic needs practice (weak, slipping, stale, untested), the evidence for
 * each, and a button that writes the quiz. See `detectAttention`.
 */
export function WeakTopicsPanel({
  items,
  className,
}: {
  items: AttentionItem[];
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Practise next</CardTitle>
      </CardHeader>

      <CardBody>
        <AttentionList
          items={items}
          empty={
            <>
              <p className="font-medium text-ink">Nothing needs you right now.</p>
              <p className="mt-0.5">
                Every topic you have tested is holding up, and none has gone quiet for long. Topics
                you have files for but have not tested will appear here too.
              </p>
            </>
          }
        />
      </CardBody>
    </Card>
  );
}
