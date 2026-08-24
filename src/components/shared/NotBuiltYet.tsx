import { Hammer } from "lucide-react";
import { EmptyState } from "@/components/ui";

/**
 * Honest scaffolding.
 *
 * Sprint 07 established the route tree; the features that fill it arrive on
 * their own sprints. Rather than leave a blank page or fake a screen with
 * invented data, each route says what it will do and when.
 *
 * Delete each usage as its sprint lands.
 */
export function NotBuiltYet({ what, sprint }: { what: string; sprint: string }) {
  return (
    <EmptyState
      Icon={Hammer}
      title="Not built yet"
      description={`${what} arrives in ${sprint}. The route, shell and error handling around it are already in place.`}
    />
  );
}
