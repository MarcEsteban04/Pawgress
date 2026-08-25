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

### Where the material upload is checked, and where it is not

From Sprint 25 the bytes of a material go **browser → Supabase Storage**, never
through Next. That is forced rather than chosen: a Server Action body is capped
at 1 MB by default and about 4.5 MB on a serverless host, both far under the
25 MB the bucket accepts.

The consequence has to be stated plainly. `validateUpload()` still runs — but
in the BROWSER, where it buys speed rather than safety. What actually gates a
material upload is:

| Gate | Where | What it stops |
|---|---|---|
| Type, size, empty-file checks | Server Action, before a ticket is minted | A client asking to upload something we do not accept |
| Subject ownership | Server Action, before a ticket is minted | Filing a file into someone else's subject, and orphan bytes from a row that would fail |
| The object path | Chosen by the server, never accepted from the client | Writing outside the caller's own folder |
| `file_size_limit`, `allowed_mime_types` | The bucket | Anything the client lied about in the request |
| Storage policies on the first path segment | Postgres | Reading or writing another student's objects |
| **`verifyUploadAction()`** | **Server, reading the stored object** | **A file whose contents are not what it was uploaded as** |

**The last row is the gate; every row above it is convenience.** Sprint 25
shipped without it and said so here. Sprint 26 closed it: after the bytes land,
the server reads a 16-byte window for the signature and, for PDFs, the last
4 KB for the trailer. A file that fails is deleted, not left as a failed row —
the student never chose to store it and nothing can read it.

Two windows, not the file. Downloading a 25 MB deck to look at four bytes would
double the cost of every upload. `readObjectRange()` signs a URL and sends a
`Range` header; Supabase answers with 206 and exactly the window asked for,
including suffix ranges like `bytes=-4096`.

### PDFs get two extra questions

```text
/Encrypt in the trailer  →  "That PDF is password-protected."
no %%EOF at the end      →  "That PDF looks incomplete."
```

Both are heuristics on the last few kilobytes rather than a parse, and both can
produce a false NEGATIVE — a PDF using cross-reference streams can keep its
encryption entry outside that window. That is the right way round: the file is
accepted and fails later with a clear message from the extractor, rather than a
valid file being refused.

**Image-only PDFs are not detected**, and US-C2 asks for them. Deciding a PDF
has no text layer means extracting it (Sprint 32); OCR for that case is
Sprint 33. This is the half of the requirement that can be met honestly before
the pipeline exists.

### Duplicates are reported, not blocked

A SHA-256 of the contents is computed in the browser before a ticket is asked
for, so a file already in the library never costs the upload (FR-U8). The hash
identifies the BYTES: the same handout arrives as `lecture3.pdf`,
`lecture3 (1).pdf` and `Lecture 3 FINAL.pdf`, and a filename cannot answer
"have I got this already?".

It is a CLAIM from the browser, and it is treated as one. The lookup runs under
RLS, so the worst a forged hash achieves is being shown one of your own
materials. It grants nothing.

Re-uploading the same handout into a second subject is legitimate, so the
student is told what was found and given both answers — "upload anyway" and
"skip it" — rather than being refused.

### Shrinking before upload is not validation

`features/settings/downscale.ts` re-encodes a picked avatar to at most 512px before the form
submits it, and puts the result back into the file input through a `DataTransfer` so the ordinary
submission carries it.

It is a **courtesy, not a control**. It runs in the browser, so anyone who wants to skip it can.
Nothing above changes because of it: the byte sniffing, the bucket limits and the storage policies
still decide what is accepted, and a resize that fails simply submits the original.

What it is for is the gap a limit cannot close. The avatar bucket accepts 25 MB, an avatar renders
at 64px, and there is no transform-on-read — so without this a 20 MB photo is stored at 20 MB and
served at 20 MB on every page that shows it. Raising a limit makes that more likely, not less.

EXIF orientation is applied during the redraw (`imageOrientation: "from-image"`), because a canvas
ignores the rotation tag unless asked and every portrait phone photo would otherwise upload
sideways.

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
