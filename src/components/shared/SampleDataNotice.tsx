import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Says, on screen, that the numbers above are not the student's own.
 *
 * A designed dashboard full of invented figures that does not admit it is the
 * single easiest way for an app to lose trust — and this product's whole pitch
 * is that its numbers can be checked. So the placeholder is labelled, in the
 * layout, at real size, until the data behind it is real.
 *
 * Delete every usage as its sprint lands.
 */
export function SampleDataNotice({ sprint, className }: { sprint: string; className?: string }) {
  return (
    <p
      className={cn(
        "inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-warn/30 bg-warn-soft px-3 py-1.5 text-xs font-medium text-warn",
        className,
      )}
    >
      <FlaskConical className="size-3.5 shrink-0" aria-hidden />
      Sample data — real figures arrive with {sprint}
    </p>
  );
}
