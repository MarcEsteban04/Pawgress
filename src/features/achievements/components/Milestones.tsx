import { Award, Circle } from "lucide-react";
import { Card, CardBody } from "@/components/ui";
import { type AchievementList } from "@/server/achievements/queries";

/**
 * Milestones on the Progress page (Sprint 72).
 *
 * **Words, the accent, and nothing else** — no character, no confetti, no
 * badge art (docs/branding.md: "celebration is copy, motion and the accent").
 * An earned milestone says what the student did; one still ahead says how to
 * get there, in the same plain voice, so the list reads as a set of things
 * worth doing rather than a collection to complete.
 *
 * **"New" for a week** after it was earned, in the accent — the one moment of
 * celebration, and it fades on its own rather than waiting to be dismissed.
 */

const NEW_FOR_MS = 7 * 86_400_000;

function earnedLabel(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function Milestones({ data, now }: { data: AchievementList; now: number }) {
  return (
    <Card>
      <CardBody className="flex flex-col gap-6 py-5">
        {data.earned.length === 0 ? (
          <p className="text-sm text-ink-muted">
            None yet. The first one is for finishing a single session — a practice set, a deck of
            flashcards, a quiz or a timed session.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.earned.map((item) => {
              const fresh = item.earnedAt !== null && now - Date.parse(item.earnedAt) < NEW_FOR_MS;
              const when = earnedLabel(item.earnedAt);
              return (
                <li
                  key={item.code}
                  className="flex items-start gap-3 rounded-[var(--radius-tile)] border border-rule p-3.5"
                >
                  <Award
                    className={
                      fresh
                        ? "mt-0.5 size-5 shrink-0 text-accent"
                        : "mt-0.5 size-5 shrink-0 text-ink-muted"
                    }
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {item.kind.title}
                        {item.name ? ` · ${item.name}` : ""}
                      </span>
                      {fresh && (
                        <span className="rounded-[var(--radius-pill)] bg-accent px-1.5 py-px text-[0.625rem] font-semibold tracking-wide text-on-accent uppercase">
                          New
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-sm text-ink-muted">{item.kind.earned}</span>
                    {when && <span className="mt-1 block text-xs text-ink-subtle">{when}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {data.ahead.length > 0 && (
          <details>
            <summary className="cursor-pointer text-sm text-ink-muted hover:text-ink">
              {data.ahead.length} still ahead
            </summary>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {data.ahead.map((kind) => (
                <li key={kind.code} className="flex items-start gap-2.5 text-sm">
                  <Circle className="mt-1 size-3 shrink-0 text-ink-subtle" aria-hidden />
                  <span>
                    <span className="font-medium">{kind.title}</span>
                    <span className="text-ink-muted"> — {kind.how}</span>
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </CardBody>
    </Card>
  );
}
