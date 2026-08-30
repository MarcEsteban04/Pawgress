"use client";

import { Check, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import { Button, Card, CardBody, Input, SectionLabel, Textarea } from "@/components/ui";
import { regenerateSectionAction, updateReviewerAction } from "@/features/reviewers/server/edit";
import {
  SECTION_LABELS,
  type ReviewerDocument,
  type ReviewerSection,
} from "@/features/reviewers/schema";

/**
 * The reviewer, and the editing of it (FR-R5, US-F5, Sprint 46).
 *
 * **Read-only until asked.** A student opens a reviewer to revise from it, not
 * to maintain it — a page of input boxes is a page nobody reads, and one stray
 * click into a contenteditable summary is an edit they did not mean to make.
 * Each section carries its own small controls and swaps into a form only when
 * one is pressed.
 *
 * **One section at a time, and only that section is sent.** The server merges
 * the patch into the stored document, so a tab left open on an old version
 * cannot overwrite a section it never displayed.
 *
 * **Regenerating is a job; editing is not.** A rewrite reads the whole subject
 * again and takes about a minute, which is why it navigates nowhere and says so
 * in place. Saving a hand edit is a database write and should feel like one.
 */

export function ReviewerDocumentView({
  reviewerId,
  document,
  sourceCount,
}: {
  reviewerId: string;
  document: ReviewerDocument;
  sourceCount: number;
}) {
  /**
   * Which section is open for editing, if any.
   *
   * One at a time, deliberately. Two open forms means two sets of unsaved
   * changes and a student who has to remember which of them they still owe a
   * save to.
   */
  const [editing, setEditing] = useState<ReviewerSection | "notes" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  function save(patch: Parameters<typeof updateReviewerAction>[1]) {
    setError(null);
    startSaving(async () => {
      const result = await updateReviewerAction(reviewerId, patch);
      if (result.status === "error") {
        setError(`${result.message} ${result.nextStep}`);
        return;
      }
      setEditing(null);
    });
  }

  function regenerate(section: ReviewerSection) {
    setError(null);
    startSaving(async () => {
      const result = await regenerateSectionAction(reviewerId, section);
      if (result.status === "error") setError(`${result.message} ${result.nextStep}`);
    });
  }

  /* Present while a rewrite is queued or running. The old section stays on
     screen underneath: a student who asked for better key terms should be able
     to keep revising the ones they have while the new ones are written. */
  const pending = document.pendingSection;

  return (
    <div className="flex flex-col gap-5">
      {error && (
        <p role="alert" className="text-sm text-bad">
          {error}
        </p>
      )}

      {pending && (
        <p className="flex items-center gap-2 rounded-[var(--radius-control)] border border-rule bg-surface-sunken px-4 py-2.5 text-sm text-ink-muted">
          <RefreshCw className="size-4 shrink-0 animate-spin text-accent" aria-hidden />
          Aki is rewriting {SECTION_LABELS[pending].toLowerCase()}. Reload in a minute to see it —
          what is below is still the old version.
        </p>
      )}

      <Section
        label={SECTION_LABELS.summary}
        hideLabel
        busy={isSaving}
        pending={pending === "summary"}
        editing={editing === "summary"}
        onEdit={() => setEditing("summary")}
        onCancel={() => setEditing(null)}
        onRegenerate={() => regenerate("summary")}
      >
        {editing === "summary" ? (
          <SummaryForm
            value={document.summary}
            busy={isSaving}
            onSave={(summary) => save({ summary })}
          />
        ) : (
          <Card>
            <CardBody className="py-5">
              <p className="leading-relaxed">{document.summary}</p>
            </CardBody>
          </Card>
        )}
      </Section>

      <Section
        label={SECTION_LABELS.focus}
        busy={isSaving}
        pending={pending === "focus"}
        editing={editing === "focus"}
        empty={document.focus.length === 0}
        onEdit={() => setEditing("focus")}
        onCancel={() => setEditing(null)}
        onRegenerate={() => regenerate("focus")}
      >
        {editing === "focus" ? (
          <LinesForm
            value={document.focus}
            busy={isSaving}
            hint="One line each — what to revise first, and why."
            onSave={(focus) => save({ focus })}
          />
        ) : (
          document.focus.length > 0 && (
            <Card>
              <CardBody className="py-4">
                <ol className="flex list-outside list-decimal flex-col gap-2 pl-5 marker:text-ink-subtle">
                  {document.focus.map((item) => (
                    <li key={item} className="leading-relaxed">
                      {item}
                    </li>
                  ))}
                </ol>
              </CardBody>
            </Card>
          )
        )}
      </Section>

      <Section
        label={SECTION_LABELS.concepts}
        busy={isSaving}
        pending={pending === "concepts"}
        editing={editing === "concepts"}
        empty={document.concepts.length === 0}
        onEdit={() => setEditing("concepts")}
        onCancel={() => setEditing(null)}
        onRegenerate={() => regenerate("concepts")}
      >
        {editing === "concepts" ? (
          <PairsForm
            value={document.concepts.map((concept) => ({
              key: concept.name,
              value: concept.explanation,
            }))}
            busy={isSaving}
            keyLabel="Concept"
            valueLabel="Explanation"
            addLabel="Add a concept"
            max={6}
            onSave={(rows) =>
              save({ concepts: rows.map((row) => ({ name: row.key, explanation: row.value })) })
            }
          />
        ) : (
          document.concepts.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2">
              {document.concepts.map((concept) => (
                <Card key={concept.name}>
                  <CardBody className="py-4">
                    <h2 className="font-display font-semibold">{concept.name}</h2>
                    <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-muted">
                      {concept.explanation}
                    </p>
                  </CardBody>
                </Card>
              ))}
            </div>
          )
        )}
      </Section>

      <Section
        label={SECTION_LABELS.terms}
        busy={isSaving}
        pending={pending === "terms"}
        editing={editing === "terms"}
        empty={document.terms.length === 0}
        onEdit={() => setEditing("terms")}
        onCancel={() => setEditing(null)}
        onRegenerate={() => regenerate("terms")}
      >
        {editing === "terms" ? (
          <PairsForm
            value={document.terms.map((term) => ({ key: term.term, value: term.definition }))}
            busy={isSaving}
            keyLabel="Term"
            valueLabel="Definition"
            addLabel="Add a term"
            max={12}
            onSave={(rows) =>
              save({ terms: rows.map((row) => ({ term: row.key, definition: row.value })) })
            }
          />
        ) : (
          document.terms.length > 0 && (
            <Card>
              <CardBody className="p-0">
                <dl className="divide-y divide-rule">
                  {document.terms.map((term) => (
                    <div
                      key={term.term}
                      className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:gap-5"
                    >
                      <dt className="font-medium sm:w-48 sm:shrink-0">{term.term}</dt>
                      <dd className="text-[0.9375rem] leading-relaxed text-ink-muted">
                        {term.definition}
                      </dd>
                    </div>
                  ))}
                </dl>
              </CardBody>
            </Card>
          )
        )}
      </Section>

      {/* The student's own words, last and labelled. There is no regenerate
          control here on purpose: a button that offers to rewrite someone's
          notes for them has misunderstood whose notes they are. */}
      <Section
        label="Your notes"
        busy={isSaving}
        editing={editing === "notes"}
        empty={!document.notes?.length}
        onEdit={() => setEditing("notes")}
        onCancel={() => setEditing(null)}
      >
        {editing === "notes" ? (
          <LinesForm
            value={document.notes ?? []}
            busy={isSaving}
            hint="Anything the reviewer missed, in your own words. One note per line."
            onSave={(notes) => save({ notes })}
          />
        ) : (
          (document.notes?.length ?? 0) > 0 && (
            <Card>
              <CardBody className="flex flex-col gap-3 py-4">
                {document.notes?.map((note) => (
                  <p key={note} className="leading-relaxed whitespace-pre-wrap">
                    {note}
                  </p>
                ))}
              </CardBody>
            </Card>
          )
        )}
      </Section>

      {/* Said once, at the end, where a student has finished reading and is
          deciding whether to trust it. Once they have edited it, it is no
          longer only Aki's — and claiming otherwise would be the product lying
          about its own provenance. */}
      <p className="text-xs leading-relaxed text-ink-subtle">
        {document.editedAt
          ? `Written by Aki from ${sourceCount} of your ${sourceCount === 1 ? "file" : "files"}, and edited by you.`
          : `Written by Aki from ${sourceCount} of your ${sourceCount === 1 ? "file" : "files"}. Check it against your material before relying on it for an exam.`}
      </p>
    </div>
  );
}

/**
 * A section, its controls, and its contents.
 *
 * The controls sit in the heading row rather than floating over the content on
 * hover: a control a student cannot see is a feature they do not have, and this
 * page is read on phones where hover does not exist.
 */
function Section({
  label,
  hideLabel = false,
  busy,
  pending = false,
  editing,
  empty = false,
  onEdit,
  onCancel,
  onRegenerate,
  children,
}: {
  label: string;
  hideLabel?: boolean;
  busy: boolean;
  pending?: boolean;
  editing: boolean;
  empty?: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onRegenerate?: () => void;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {hideLabel ? (
          <span className="sr-only">{label}</span>
        ) : (
          <SectionLabel>{label}</SectionLabel>
        )}

        <div className="ml-auto flex items-center gap-1">
          {editing ? (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] px-2 py-1 text-xs font-medium text-ink-subtle transition-colors hover:text-ink"
            >
              <X className="size-3.5" aria-hidden />
              Cancel
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onEdit}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] px-2 py-1 text-xs font-medium text-ink-subtle transition-colors hover:text-ink disabled:opacity-50"
              >
                <Pencil className="size-3.5" aria-hidden />
                {empty ? "Add" : "Edit"}
              </button>
              {onRegenerate && (
                <button
                  type="button"
                  onClick={onRegenerate}
                  disabled={busy || pending}
                  className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] px-2 py-1 text-xs font-medium text-ink-subtle transition-colors hover:text-ink disabled:opacity-50"
                >
                  <RefreshCw className="size-3.5" aria-hidden />
                  {pending ? "Rewriting…" : "Rewrite"}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {children}
      {!editing && empty && (
        <p className="text-sm text-ink-subtle">
          Nothing here yet.
          {onRegenerate ? " Add your own, or ask Aki to write this section." : ""}
        </p>
      )}
    </section>
  );
}

/** One long field. */
function SummaryForm({
  value,
  busy,
  onSave,
}: {
  value: string;
  busy: boolean;
  onSave: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        value={draft}
        rows={6}
        autoFocus
        aria-label="Summary"
        onChange={(event) => setDraft(event.target.value)}
      />
      <SaveRow busy={busy} disabled={!draft.trim()} onSave={() => onSave(draft.trim())} />
    </div>
  );
}

/**
 * A list of one-liners, edited as text.
 *
 * A row of inputs with add and remove buttons would be more "correct" and much
 * worse to use for four short lines: reordering means dragging, adding means
 * clicking, and every one of those is a thing to learn. A textarea is a list
 * everyone already knows how to edit.
 */
function LinesForm({
  value,
  busy,
  hint,
  onSave,
}: {
  value: string[];
  busy: boolean;
  hint: string;
  onSave: (value: string[]) => void;
}) {
  const [draft, setDraft] = useState(value.join("\n"));
  const lines = draft
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        value={draft}
        rows={5}
        autoFocus
        aria-label={hint}
        onChange={(event) => setDraft(event.target.value)}
      />
      <p className="text-xs text-ink-subtle">{hint}</p>
      {/* Empty is allowed, and is how a section is deleted. Clearing the box
          and saving removes the section, which is the same gesture as removing
          any one line — no separate "delete section" button to find. */}
      <SaveRow busy={busy} onSave={() => onSave(lines)} />
    </div>
  );
}

type Pair = { key: string; value: string };

/** Concepts and terms: a name and a body, repeated. */
function PairsForm({
  value,
  busy,
  keyLabel,
  valueLabel,
  addLabel,
  max,
  onSave,
}: {
  value: Pair[];
  busy: boolean;
  keyLabel: string;
  valueLabel: string;
  addLabel: string;
  max: number;
  onSave: (value: Pair[]) => void;
}) {
  const [rows, setRows] = useState<Pair[]>(value);

  function update(index: number, patch: Partial<Pair>) {
    setRows((previous) =>
      previous.map((row, position) => (position === index ? { ...row, ...patch } : row)),
    );
  }

  /* Rows that are half-filled are dropped rather than rejected. A student who
     typed a term and no definition and then pressed save meant to save the rest
     of their work, not to be told off about the last row. */
  const complete = rows
    .map((row) => ({ key: row.key.trim(), value: row.value.trim() }))
    .filter((row) => row.key && row.value);

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row, index) => (
        <div
          key={index}
          className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-rule bg-surface p-3"
        >
          <div className="flex items-center gap-2">
            <Input
              value={row.key}
              placeholder={keyLabel}
              aria-label={`${keyLabel} ${index + 1}`}
              onChange={(event) => update(index, { key: event.target.value })}
              className="flex-1"
            />
            <button
              type="button"
              aria-label={`Delete ${keyLabel.toLowerCase()} ${index + 1}`}
              onClick={() => setRows((previous) => previous.filter((_, i) => i !== index))}
              className="rounded-full p-2 text-ink-subtle transition-colors hover:bg-bad-soft hover:text-bad"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </div>
          <Textarea
            value={row.value}
            rows={3}
            placeholder={valueLabel}
            aria-label={`${valueLabel} ${index + 1}`}
            onChange={(event) => update(index, { value: event.target.value })}
          />
        </div>
      ))}

      {rows.length < max && (
        <Button
          variant="subtle"
          size="sm"
          className="self-start"
          onClick={() => setRows((previous) => [...previous, { key: "", value: "" }])}
        >
          <Plus aria-hidden />
          {addLabel}
        </Button>
      )}

      <SaveRow busy={busy} onSave={() => onSave(complete)} />
    </div>
  );
}

function SaveRow({
  busy,
  disabled = false,
  onSave,
}: {
  busy: boolean;
  disabled?: boolean;
  onSave: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button size="sm" disabled={busy || disabled} onClick={onSave}>
        <Check aria-hidden />
        {busy ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
