"use client";

import { useActionState, useId, useState, useSyncExternalStore } from "react";
import { useFormStatus } from "react-dom";
import { Button, Chip, ErrorState, Field, Input, Select } from "@/components/ui";
import { initialSettingsState } from "@/features/settings/types";
import { updateProfileAction } from "@/features/settings/server/actions";
import { SESSION_MINUTE_OPTIONS, YEAR_LEVELS } from "@/lib/validation/profile";
import { type Profile } from "@/server/profile/queries";

/**
 * Profile settings (FR-A7).
 *
 * Only the name is required. Year level and school are optional because
 * students may be minors and NFR-P1 says to collect only what a feature needs —
 * these two feed the planner's sense of a school year, and an empty one costs
 * nothing but a slightly less specific plan.
 */

function SaveButton({ dirty }: { dirty: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="accent" disabled={pending || !dirty}>
      {pending ? "Saving…" : dirty ? "Save changes" : "Saved"}
    </Button>
  );
}

/** The browser's zone never changes mid-session, so there is nothing to subscribe to. */
const NO_OP_SUBSCRIBE = () => () => {};

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, formAction] = useActionState(updateProfileAction, initialSettingsState);
  const [minutes, setMinutes] = useState(profile.preferredSessionMinutes);
  const [touched, setTouched] = useState(false);

  const nameId = useId();
  const yearId = useId();
  const schoolId = useId();

  /**
   * The browser's timezone, read straight from the environment rather than
   * copied into state by an effect — an effect that calls `setState` triggers a
   * second render pass on every mount for a value that cannot change.
   *
   * `useSyncExternalStore` is the right tool because the server and the browser
   * genuinely disagree: the server has no idea where the student is, so it
   * renders the stored value, and the client swaps in the detected one without
   * a hydration mismatch.
   *
   * It is shown rather than saved silently. A study plan is built around what
   * "today" means, and the stored default of UTC is wrong for everyone outside
   * London — but rewriting it behind the student's back is not better.
   */
  const detectedTimezone = useSyncExternalStore(
    NO_OP_SUBSCRIBE,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || profile.timezone,
    () => profile.timezone,
  );

  const timezoneChanged = detectedTimezone !== profile.timezone;

  /**
   * Reset the dirty flag when a save comes back, adjusted during render rather
   * than in an effect. This is React's sanctioned pattern for "derive state
   * from a changed input": it re-renders before committing, so nothing flashes.
   */
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state.status === "saved") setTouched(false);
  }

  const dirty = touched || timezoneChanged;

  return (
    <form action={formAction} onChange={() => setTouched(true)} className="flex flex-col gap-5">
      {state.status === "error" && state.message && !state.fieldErrors?.displayName && (
        <ErrorState title={state.message} nextStep={state.nextStep ?? ""} />
      )}

      <Field
        label="Display name"
        htmlFor={nameId}
        error={state.fieldErrors?.displayName}
        hint="What Pawgress calls you. Only you see it."
      >
        <Input
          id={nameId}
          name="displayName"
          defaultValue={profile.displayName}
          required
          maxLength={80}
          autoComplete="nickname"
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Year level" htmlFor={yearId} optional error={state.fieldErrors?.yearLevel}>
          <Select id={yearId} name="yearLevel" defaultValue={profile.yearLevel ?? ""}>
            <option value="">Prefer not to say</option>
            {YEAR_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="School" htmlFor={schoolId} optional error={state.fieldErrors?.school}>
          <Input
            id={schoolId}
            name="school"
            defaultValue={profile.school ?? ""}
            maxLength={120}
            autoComplete="organization"
          />
        </Field>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-[0.9375rem] font-medium">Preferred study block</legend>
        <p className="text-sm text-ink-subtle">
          How long a single block should be when Pawgress builds your plan.
        </p>
        <input type="hidden" name="preferredSessionMinutes" value={minutes} />
        <div className="mt-1 flex flex-wrap gap-2">
          {SESSION_MINUTE_OPTIONS.map((option) => (
            <Chip
              key={option}
              size="sm"
              selected={minutes === option}
              onClick={() => {
                setMinutes(option);
                setTouched(true);
              }}
            >
              {option} min
            </Chip>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1">
        <span className="text-[0.9375rem] font-medium">Timezone</span>
        <input type="hidden" name="timezone" value={detectedTimezone} />
        <p className="text-sm text-ink-muted">
          <span className="tabular">{detectedTimezone}</span>
          {timezoneChanged && (
            <span className="text-warn"> — detected from your browser, save to keep it</span>
          )}
        </p>
        <p className="text-sm text-ink-subtle">
          Your plan is built around your day, so this decides when &ldquo;today&rdquo; starts.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <SaveButton dirty={dirty} />
        {state.status === "saved" && (
          <span className="text-sm text-good" role="status">
            Profile saved.
          </span>
        )}
      </div>
    </form>
  );
}
