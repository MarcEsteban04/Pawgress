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
    <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-surface-sunken text-ink-subtle">
        <Icon className="size-[1.125rem]" aria-hidden />
      </span>
      <div>
        <p className="font-medium">{title}</p>
        <p className="mx-auto mt-1 max-w-[34ch] text-sm leading-relaxed text-ink-muted">
          {description}
        </p>
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
