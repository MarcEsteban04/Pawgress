"use client";

import { TriangleAlert } from "lucide-react";
import { Component, type ReactNode } from "react";
import { Button } from "./Button";
import { Card, CardBody, CardHeader, CardTitle } from "./Card";

/**
 * Keeps one failing panel from taking a page down with it.
 *
 * **Suspense does not do this.** A Suspense boundary handles a pending
 * promise; a REJECTED one passes straight through it to the nearest error
 * boundary — which, without this, is the route's `error.tsx`, and the whole
 * page is replaced. Sprint 23 split the subject hub into six Suspense
 * boundaries and described them as isolating failures. That was only half
 * true, and this is the other half.
 *
 * A class component, and it has to be: `componentDidCatch` has no hook
 * equivalent. React has not shipped one, and `error.tsx` is Next's own class
 * boundary underneath.
 *
 * `reset` clears the caught error and re-renders the children. When the cause
 * was transient — a dropped connection, a cold start — that is enough. When it
 * was not, the panel fails again and says so again, which is honest: a retry
 * button that hides a permanent failure is worse than no retry button.
 */

type Props = { title: string; children: ReactNode };
type State = { error: Error | null };

export class PanelBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Sprint 77 (production release) wires this to real error tracking (NFR-O2).
    console.error(`Panel "${this.props.title}" failed:`, error);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <Card className="border-bad/30">
        <CardHeader>
          <CardTitle>{this.props.title}</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col items-start gap-3">
          <p className="flex items-start gap-2 text-sm leading-relaxed text-ink-muted">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden />
            {/* Says what is and is not affected. "Something went wrong" leaves a
                student wondering whether their work is gone (docs/states.md §5). */}
            <span>
              This section could not load. Nothing here is lost — the rest of the page is fine.
            </span>
          </p>
          <Button variant="subtle" size="sm" onClick={() => this.setState({ error: null })}>
            Try again
          </Button>
        </CardBody>
      </Card>
    );
  }
}
