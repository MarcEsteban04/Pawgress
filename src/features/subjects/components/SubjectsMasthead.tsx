import { type ReactNode } from "react";
import { type LibraryTotals } from "@/server/subjects/queries";
import { cn } from "@/lib/utils";

/**
 * The masthead of the subject library.
 *
 * A page whose first element is a plain heading and four dropdowns reads as a
 * settings screen. This is the one place a student sees their whole library, so
 * it opens by saying what that library IS — three real figures, read from the
 * database, not decoration.
 *
 * **The numbers are the point, not the gradient.** Everything visual here
 * exists to give them a surface to sit on: a wash that fades before it reaches
 * the text, a dot texture at low contrast, and a hairline. There is no
 * illustration, because an illustration would occupy the space the data should.
 *
 * Scoped to ACTIVE subjects, matching `getLibraryTotals`. Counting archived
 * classes would undo archiving — the figure would keep climbing for work a
 * student has finished.
 */
export function SubjectsMasthead({
  eyebrow,
  title,
  description,
  totals,
  action,
  tone = "accent",
}: {
  eyebrow: string;
  title: string;
  description: string;
  /** Omitted in the archive view, where "your library" is the wrong frame. */
  totals?: LibraryTotals;
  action?: ReactNode;
  /** The archive is deliberately colourless — it is out of the way. */
  tone?: "accent" | "quiet";
}) {
  const figures = totals
    ? [
        { value: totals.subjects, label: totals.subjects === 1 ? "Subject" : "Subjects" },
        { value: totals.materials, label: totals.materials === 1 ? "File" : "Files" },
        { value: totals.topics, label: totals.topics === 1 ? "Topic" : "Topics" },
      ]
    : [];

  return (
    <section
      className={cn(
        "relative isolate overflow-hidden rounded-[var(--radius-canvas)] border border-rule bg-surface",
        "shadow-[var(--shadow-card)]",
      )}
    >
      {/* Decorative layers, in paint order. `pointer-events-none` on both so
          they never intercept a click meant for the button. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: "radial-gradient(var(--dot) 1px, transparent 1px)",
          backgroundSize: "10px 10px",
          /* Masked so the texture fades out before it reaches the reading
             column. Texture behind body copy is noise; texture at the edge is
             material. */
          maskImage: "radial-gradient(120% 100% at 100% 0%, black 0%, transparent 62%)",
        }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            tone === "accent"
              ? "radial-gradient(90% 130% at 100% -10%, var(--accent-soft) 0%, transparent 60%)"
              : "radial-gradient(90% 130% at 100% -10%, var(--surface-sunken) 0%, transparent 60%)",
        }}
      />

      <div className="relative flex flex-col gap-8 p-6 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-[46ch] min-w-0">
            <p className="text-sm font-medium text-ink-muted">{eyebrow}</p>
            {/* Tighter tracking than the type ramp's default. At display size
                the default spacing reads as loose — this is the one place the
                title is large enough for that to show. */}
            <h1 className="mt-2 font-display text-[2.125rem] leading-[1.05] font-semibold tracking-[-0.03em] sm:text-[2.75rem]">
              {title}
            </h1>
            <p className="mt-3 leading-relaxed text-ink-muted">{description}</p>
          </div>

          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </div>

        {figures.length > 0 && (
          /* A hairline above rather than a card around: the figures belong to
             the masthead, and boxing them would make a panel inside a panel. */
          <dl className="flex flex-wrap items-end gap-x-10 gap-y-5 border-t border-rule pt-6">
            {figures.map((figure) => (
              <div key={figure.label}>
                <dd className="tabular font-display text-[1.75rem] leading-none font-semibold">
                  {figure.value}
                </dd>
                <dt className="mt-2 text-[0.6875rem] font-medium tracking-[0.09em] text-ink-subtle uppercase">
                  {figure.label}
                </dt>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}
