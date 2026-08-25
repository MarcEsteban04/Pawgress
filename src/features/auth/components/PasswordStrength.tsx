import { scorePassword } from "@/lib/validation/auth";
import { cn } from "@/lib/utils";

/**
 * The strength meter under the password field.
 *
 * Four segments plus WORDS. Never colour alone (NFR-A3) — a red bar means
 * nothing on a greyscale screen, to a colour-blind reader, or on a cheap phone
 * at low brightness, so the label carries the meaning and the bar reinforces it.
 *
 * The tones here are status tokens rather than data tokens, because this is
 * genuinely a state ("too common", "strong") and not a measurement.
 */
const TONE = {
  0: { fill: "bg-bad", text: "text-bad" },
  1: { fill: "bg-bad", text: "text-bad" },
  2: { fill: "bg-warn", text: "text-warn" },
  3: { fill: "bg-good", text: "text-good" },
  4: { fill: "bg-good", text: "text-good" },
} as const;

export function PasswordStrength({ password, id }: { password: string; id?: string }) {
  const { score, label, hint } = scorePassword(password);
  const empty = password.length === 0;
  const tone = TONE[score];

  return (
    <div id={id} aria-live="polite" className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1" aria-hidden>
          {[1, 2, 3, 4].map((segment) => (
            <span
              key={segment}
              className={cn(
                "h-1 flex-1 rounded-[var(--radius-pill)] transition-colors",
                !empty && score >= segment ? tone.fill : "bg-surface-sunken",
              )}
            />
          ))}
        </div>
        {!empty && (
          <span className={cn("text-xs font-medium", tone.text)}>
            {/* The screen-reader phrasing states what the bar means, since the
                segments themselves are hidden from it. */}
            <span className="sr-only">Password strength: </span>
            {label}
          </span>
        )}
      </div>
      {!empty && hint && <p className="text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}
