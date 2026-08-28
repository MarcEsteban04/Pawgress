import { type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";
import Link from "next/link";
import { buttonStyles } from "@/components/ui";

/**
 * What a dashboard panel says when it has nothing to show.
 *
 * Two different kinds of empty, and saying which is the whole point:
 *
 *   `action`  — the student can fix this now. Give them the one link that does.
 *   `control` — same, but the fix is a dialog rather than a destination. The
 *               empty state is where a student is already looking, so the
 *               control belongs here as well as in the panel header.
 *   `awaiting`— the feature that fills this panel does not exist yet. Say so
 *               plainly, because "take a quiz to see your mastery" is a lie
 *               when quizzes cannot be taken, and a student who tries and finds
 *               nothing trusts the next message less.
 */
export function PanelEmpty({
  Icon,
  title,
  description,
  action,
  control,
  awaiting,
}: {
  Icon: LucideIcon;
  title: string;
  description: string;
  action?: { href: string; label: string };
  control?: ReactNode;
  awaiting?: string;
}) {
  return (
    /* Left-aligned and tighter than it was.

       Centred with a big circular icon, an empty panel reads as an EVENT — it
       draws as much attention as a panel with data in it, and a page of four
       says the product is mostly absent. These are captions explaining why a
       box is quiet, so they sit at the top-left where a caption goes and take
       the height a caption needs. */
    <div className="flex flex-col items-start gap-2 py-1">
      <span className="flex items-center gap-2 text-ink-subtle">
        <Icon className="size-4 shrink-0" aria-hidden />
        <span className="text-[0.9375rem] font-medium text-ink">{title}</span>
      </span>
      <div>
        <p className="max-w-[46ch] text-sm leading-relaxed text-ink-muted">{description}</p>
      </div>
      {action && (
        <Link href={action.href} className={buttonStyles({ variant: "subtle", size: "sm" })}>
          {action.label}
        </Link>
      )}
      {control}
      {awaiting && <p className="text-xs text-ink-subtle">{awaiting}</p>}
    </div>
  );
}
