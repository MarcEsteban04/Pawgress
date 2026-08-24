import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Page title plus its primary action.
 *
 * On a website the primary action belongs in the page header, not pinned to the
 * bottom of the window — that is native-app chrome. Below 640px the action
 * drops to its own full-width row so it stays reachable.
 */
export function PageHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-start", className)}>
      <div className="min-w-0 flex-1">
        <h1 className="font-display text-2xl font-medium tracking-tight sm:text-[1.75rem]">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-[60ch] leading-relaxed text-ink-muted">{description}</p>
        )}
      </div>
      {action && <div className="flex shrink-0 gap-2 max-sm:w-full">{action}</div>}
    </div>
  );
}
