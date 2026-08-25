import { type ZodType } from "zod";
import { AppError } from "@/lib/errors";

/**
 * One way to get a validated object out of a `FormData` (Sprint 17, NFR-R3).
 *
 * Before this, every action repeated the same twelve lines: read the fields,
 * `safeParse`, flatten the error, pick the first message per field, build a
 * state object. Twelve lines copied six times is six chances to forget the
 * flatten and return a Zod error straight to the screen.
 *
 * The shape it returns is deliberately the same shape every form state uses, so
 * an action can hand it back unchanged.
 */

export type FieldErrors<T> = Partial<Record<keyof T & string, string>>;

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; fieldErrors: FieldErrors<T>; message: string; nextStep: string };

/**
 * `FormData` values are `string | File`. Everything a Zod object schema wants
 * is read out here rather than in each action, including the checkbox case
 * where an unchecked box sends nothing at all.
 */
function toPlainObject(formData: FormData, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const values = formData.getAll(key);
    if (values.length === 0) {
      out[key] = undefined;
    } else if (values.length === 1) {
      out[key] = values[0];
    } else {
      out[key] = values;
    }
  }
  return out;
}

export function parseForm<T extends Record<string, unknown>>(
  schema: ZodType<T>,
  formData: FormData,
  keys: readonly (keyof T & string)[],
): ParseResult<T> {
  const parsed = schema.safeParse(toPlainObject(formData, keys));

  if (parsed.success) return { ok: true, data: parsed.data };

  const fieldErrors: FieldErrors<T> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    if (typeof field !== "string") continue;
    // First message per field. A stack of three messages under one input is
    // noise; the first is the one that has to be fixed anyway.
    if (!(field in fieldErrors)) {
      fieldErrors[field as keyof T & string] = issue.message;
    }
  }

  /* When nothing mapped to a field — a schema-level `.refine()`, say — the
     message still has to reach the student, so it becomes the form-level one
     rather than disappearing. */
  const unfielded = parsed.error.issues.find((issue) => issue.path.length === 0);

  return {
    ok: false,
    fieldErrors,
    message: unfielded?.message ?? "Check the details above.",
    nextStep: "Fix the highlighted field and try again.",
  };
}

/** The same failure, as an `AppError`, for callers that throw rather than return. */
export function validationError(message: string, nextStep = "Check the field and try again.") {
  return new AppError({ code: "validation", message, nextStep });
}
