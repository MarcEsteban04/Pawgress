# Pawgress — Validation & Error Standards

**Sprint 17 deliverable.** Where input is checked, how failures are shaped, and which of the two
sanitisers to reach for.

The rule underneath all of it (NFR-R3): **every value that crosses a boundary is validated at that
boundary.** Forms, route params, uploads, and — from Sprint 31 — model output.

---

## 1. The layers, and which one is load-bearing

| Layer | Where | What it is for |
|---|---|---|
| Client | The form component | Answering without a round trip. **Not** security — it is two lines in a console away from gone |
| Server action / route handler | [`lib/validation/`](../src/lib/validation/) | The check that actually decides |
| Database | CHECK constraints, RLS | The one that holds when application code is wrong |

The duplication is deliberate. Removing the client copy costs responsiveness; removing the server
copy costs everything.

---

## 2. Forms

`parseForm(schema, formData, keys)` is the one way to get a validated object out of a `FormData`.

```ts
const parsed = parseForm(profileSchema, formData, ["displayName", "school"]);
if (!parsed.ok) {
  return { status: "error", message: parsed.message, nextStep: parsed.nextStep,
           fieldErrors: parsed.fieldErrors };
}
```

It returns the first message per field — a stack of three under one input is noise, and the first
has to be fixed anyway — and promotes a schema-level `.refine()` message to the form level rather
than letting it disappear.

Before this, six actions each repeated the same twelve lines of `safeParse`-and-flatten. Twelve
lines copied six times is six chances to forget the flatten and put a raw Zod error on screen.

---

## 3. Uploads

**`file.type` comes from the browser and is attacker-controlled.** Renaming `payload.html` to
`notes.pdf` sets it to `application/pdf`, and every check that trusts it passes.

`validateUpload()` reads the leading bytes and requires the declared type to match what the file
actually begins with. It returns the `File` on success rather than a bare `null`, so the caller ends
up with a properly typed value instead of casting an `unknown` it was just told is safe.

```ts
const checked = await validateUpload(file, { accept, maxBytes, label });
if (!checked.ok) return errorFormState(checked.error);
// checked.file is a File, and its bytes agree with its type
```

DOCX and PPTX are both Zip archives and share `PK\x03\x04`, so they are one `zip-office` family
separated by the declared type — as far as it is worth going without unzipping the container.

**This is not a virus scanner** and does not pretend to be. It stops obvious mislabelling, and it
stops the Sprint 32 extraction pipeline being handed something that is not the format it was told
to parse.

Three checks sit behind it regardless: the bucket's own `file_size_limit` and `allowed_mime_types`,
and the storage policies. Those cannot be edited out in a console.

---

## 4. Sanitising

Two functions, kept apart because conflating them is how one ends up half-done.

**`cleanText` — for text a person reads.** Normalises to NFC and strips the characters that let a
string lie about what it says: C0 controls, zero-width joiners, and bidirectional overrides. The
bidi ones matter most — U+202E reverses everything after it, which is the classic trick for making
`annexe_txt.pdf` render as `annexe_fdp.txt`. A student deciding whether to trust a filename deserves
to see the filename. Tabs and newlines survive; they are structure in extracted material.

**`fenceUntrusted` — for text a model reads (NFR-S5).** A student's notes can contain "ignore your
previous instructions", and a PDF found online can contain it deliberately. Fencing does not make
that impossible — nothing does, with current models — but it gives the model an unambiguous
boundary, and it stops the far more common accident of material that merely *looks* like an
instruction being followed as one. The delimiter is stripped from the content first, so nothing
inside can close the fence early.

Neither escapes HTML, and neither needs to: React escapes everything it renders. The day something
reaches `dangerouslySetInnerHTML`, that is where escaping belongs.

Note there are **two** filename cleaners, for two different jobs:
`safeFileName` in [`lib/supabase/storage.ts`](../src/lib/supabase/storage.ts) builds a safe storage
*path* and will mangle a name beyond recognition to do it; `cleanFileName` in
[`lib/sanitize.ts`](../src/lib/sanitize.ts) keeps a name readable, because it is what appears in the
material library and in citations.

---

## 5. Error shape

One shape everywhere, so a caller never has to guess whether the message is in `error`, `message` or
`detail`.

```json
{ "error": { "code": "quota_exceeded", "message": "…", "nextStep": "…", "requestId": "…" } }
```

`code` is for a caller to branch on. `message` and `nextStep` are for a person, and **both are
required** — an error without a next step is a dead end (docs/states.md §5). Neither ever carries a
provider string or a stack trace.

| Helper | Use |
|---|---|
| `errorResponse(thrown, requestId)` | Route handlers. Maps the code to a status, logs unexpected causes server-side, returns them to nobody |
| `errorFormState(thrown)` | Server actions. Expected failures are RETURNED, not thrown — throwing swaps a usable screen for an error boundary |
| `statusForError(error)` | The single code→status table, so two handlers cannot disagree |

Statuses are fixed per code: `validation` 400, `unauthenticated` 401, `forbidden` 403, `not_found`
404, `quota_exceeded` and `rate_limited` 429, `unreadable_file` 415, `not_ready` 409,
`invalid_ai_output` 502, `provider_unavailable` 503, `unexpected` 500. Every error response carries
`Cache-Control: no-store` — a 429 cached by a CDN would keep rejecting a student long after their
quota reset.
