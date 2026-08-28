"use client";

import { Pencil, TriangleAlert } from "lucide-react";
import { useActionState, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  ErrorState,
  SectionLabel,
  Textarea,
} from "@/components/ui";
import { correctOcrTextAction } from "@/features/materials/server/ocr";
import { initialMaterialState } from "@/features/materials/types";
import { LOW_CONFIDENCE_THRESHOLD } from "@/features/materials/ocr";

/**
 * What we read out of a photo, and the chance to fix it (US-C7).
 *
 * Shown for every OCR'd image, not only the shaky ones. A student cannot judge
 * whether a reviewer will be any good without seeing what Acadify actually
 * read — and a transcription that is 95% right in a way they never see is the
 * one that produces a confidently wrong flashcard.
 *
 * The confidence warning is deliberately not a refusal. A rough reading of
 * someone's own handwriting is still useful to them, as long as they know it is
 * rough and can correct it.
 */

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="accent" size="sm" disabled={pending}>
      {pending ? "Saving…" : "Save corrections"}
    </Button>
  );
}

export function OcrTranscript({
  materialId,
  text,
  confidence,
}: {
  materialId: string;
  text: string;
  /** Null once a student has corrected it — the text is theirs, not a guess. */
  confidence: number | null;
}) {
  const [state, formAction] = useActionState(correctOcrTextAction, initialMaterialState);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const fieldId = useId();

  const lowConfidence = confidence !== null && confidence < LOW_CONFIDENCE_THRESHOLD;
  const saved = state.status === "saved";

  return (
    <Card>
      <CardBody className="flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionLabel>What we read from this photo</SectionLabel>
          {confidence !== null && (
            <span className="tabular text-xs text-ink-subtle">
              {Math.round(confidence * 100)}% confident
            </span>
          )}
        </div>

        {/* Icon and words, never colour alone (NFR-A3). */}
        {lowConfidence && !saved && (
          <p className="flex items-start gap-2 rounded-[var(--radius-card)] border border-warn/30 bg-warn-soft px-3 py-2.5 text-xs leading-relaxed text-warn">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              This photo was hard to read, so the text below may be wrong in places. Anything built
              from it — reviewers, flashcards, quizzes — inherits those mistakes. Worth a look
              before you rely on it.
            </span>
          </p>
        )}

        {state.status === "error" && state.message && (
          <ErrorState title={state.message} nextStep={state.nextStep ?? ""} />
        )}

        {saved && (
          <p role="status" className="text-sm text-good">
            Saved. This is your text now, not a transcription.
          </p>
        )}

        {editing ? (
          <form action={formAction} className="flex flex-col gap-3">
            <input type="hidden" name="id" value={materialId} />
            <label htmlFor={fieldId} className="sr-only">
              Corrected text
            </label>
            <Textarea
              id={fieldId}
              name="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={14}
              required
              className="min-h-[18rem] leading-relaxed"
            />
            <div className="flex flex-wrap gap-2">
              <SaveButton />
              <Button
                type="button"
                variant="subtle"
                size="sm"
                onClick={() => {
                  setDraft(text);
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          /* Pre-wrap, and rendered as text: this came out of a photograph a
             student supplied, so it is untrusted input like anything else. */
          <div className="max-h-[24rem] overflow-y-auto rounded-[var(--radius-card)] bg-surface-sunken p-4 text-[0.9375rem] leading-relaxed whitespace-pre-wrap">
            {draft}
          </div>
        )}
      </CardBody>

      {!editing && (
        <CardFooter>
          <Button variant="subtle" size="sm" onClick={() => setEditing(true)}>
            <Pencil aria-hidden />
            Fix the text
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
