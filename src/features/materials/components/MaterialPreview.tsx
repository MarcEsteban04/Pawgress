import { ExternalLink, FileQuestion, FileText, ImageOff, Pencil } from "lucide-react";
import Link from "next/link";
import { buttonStyles, Card, CardBody, CardFooter } from "@/components/ui";
import { KIND_LABELS } from "@/features/materials/upload";
import { type Material } from "@/server/materials/queries";

/**
 * In-app preview of an uploaded file (FR-U6, US-C6).
 *
 * **Why the browser's PDF viewer and not pdf.js.**
 *
 * pdf.js gives pixel control and works in every browser, and it costs upwards of
 * a megabyte of JavaScript plus a worker. That is a bad trade here for three
 * reasons: students are often on metered data (docs/wireframes.md §12); the
 * browser already renders PDFs well on the desktop widths this app is designed
 * for; and PDF open parameters give page-level deep links — `#page=6` — for
 * free, which is exactly what a citation from the assistant will need in
 * Sprint 36. Rendering a document the browser renders anyway, to gain nothing
 * a student can see, is not a good use of their bandwidth.
 *
 * What it costs: iframed PDFs are unreliable on mobile browsers, where Safari
 * and Chrome for Android often show a blank frame or a download prompt. So the
 * frame is desktop-only and narrow viewports get a real button instead of an
 * empty box — the failure is designed rather than discovered.
 *
 * If page highlighting or text selection ever becomes a requirement, pdf.js is
 * the escape hatch and only this file changes.
 *
 * The preview deliberately does NOT depend on processing status. `extracting`
 * means the text is not searchable yet; the bytes have been in storage since the
 * upload finished, so there is no reason to withhold the file a student came
 * here to look at.
 */

/** Where the bytes come from. See the route handler for why it is not a signed URL. */
function fileUrl(material: Material, opts?: { download?: boolean; page?: number }): string {
  const base = `/subjects/${material.subjectId}/materials/${material.id}/file`;
  if (opts?.download) return `${base}?download=1`;
  // A PDF open parameter, not a route fragment — the browser's viewer reads it.
  return opts?.page ? `${base}#page=${opts.page}` : base;
}

function PreviewFrame({ children }: { children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <CardBody className="p-0">{children}</CardBody>
    </Card>
  );
}

/**
 * The shape used whenever there is nothing to render inline: a reason, and the
 * action that still works. Never a blank frame (docs/states.md §1).
 */
function NoPreview({
  Icon,
  title,
  description,
  material,
}: {
  Icon: typeof FileText;
  title: string;
  description: string;
  material: Material;
}) {
  return (
    <PreviewFrame>
      <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-surface-sunken text-ink-subtle">
          <Icon className="size-5" aria-hidden />
        </span>
        <p className="font-display text-lg font-medium">{title}</p>
        <p className="max-w-[42ch] text-sm leading-relaxed text-ink-muted">{description}</p>
        {material.storagePath && (
          <a
            href={fileUrl(material, { download: true })}
            className={buttonStyles({ variant: "subtle", size: "sm" })}
          >
            Download the original
          </a>
        )}
      </div>
    </PreviewFrame>
  );
}

export function MaterialPreview({
  material,
  page,
  noteBody,
}: {
  material: Material;
  page?: number;
  /** The note's text. Only fetched for notes — see `getMaterialText`. */
  noteBody?: string | null;
}) {
  if (material.kind === "note") {
    /* `whitespace-pre-wrap` because a student's line breaks are the structure
       of the note. Rendered as text, never as markup: this is untrusted input
       and React escaping is the reason it is safe (lib/sanitize.ts). */
    return (
      <Card>
        <CardBody className="p-6 sm:p-8">
          {noteBody ? (
            <div className="mx-auto max-w-[68ch] text-[0.9375rem] leading-relaxed whitespace-pre-wrap">
              {noteBody}
            </div>
          ) : (
            <p className="text-sm text-ink-muted">This note is empty.</p>
          )}
        </CardBody>
        <CardFooter>
          <Link
            href={`/subjects/${material.subjectId}/materials/${material.id}/edit`}
            className={buttonStyles({ variant: "subtle", size: "sm" })}
          >
            <Pencil aria-hidden />
            Edit note
          </Link>
        </CardFooter>
      </Card>
    );
  }

  if (!material.storagePath) {
    return (
      <NoPreview
        Icon={FileQuestion}
        title="No file attached"
        description="This entry has no stored file. That should not happen — if it keeps showing, delete it and upload again."
        material={material}
      />
    );
  }

  if (material.kind === "image") {
    /* HEIC is accepted at upload because iPhones produce it, and almost no
       browser renders it. Saying so beats a broken image icon. */
    const isHeic = material.storagePath.toLowerCase().endsWith(".heic");
    if (isHeic) {
      return (
        <NoPreview
          Icon={ImageOff}
          title="Browsers cannot show HEIC"
          description="Your iPhone saved this in Apple's format, which browsers do not display. Acadify can still read it — text extraction works — but a preview needs a JPEG or PNG."
          material={material}
        />
      );
    }

    return (
      <PreviewFrame>
        {/* eslint-disable-next-line @next/next/no-img-element -- the optimizer cannot read a private object behind an auth-checked redirect */}
        <img
          src={fileUrl(material)}
          alt={material.title}
          className="mx-auto max-h-[75vh] w-auto max-w-full bg-surface-sunken object-contain"
        />
      </PreviewFrame>
    );
  }

  if (material.kind === "pdf") {
    return (
      <>
        {/* Desktop: the browser's own viewer, which brings paging, search,
            zoom and printing with it. */}
        <div className="hidden md:block">
          <PreviewFrame>
            <iframe
              src={fileUrl(material, { page })}
              title={material.title}
              className="h-[75vh] min-h-[30rem] w-full bg-surface-sunken"
            />
          </PreviewFrame>
        </div>

        {/* Narrow viewports: a designed fallback, not an empty frame. */}
        <div className="md:hidden">
          <PreviewFrame>
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <span className="flex size-11 items-center justify-center rounded-full bg-surface-sunken text-ink-subtle">
                <FileText className="size-5" aria-hidden />
              </span>
              <p className="font-display text-lg font-medium">Open this PDF</p>
              <p className="max-w-[38ch] text-sm leading-relaxed text-ink-muted">
                Phone browsers show PDFs in their own viewer rather than inside a page.
                {material.pageCount !== null && ` ${material.pageCount} pages.`}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <a
                  href={fileUrl(material, { page })}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonStyles({ variant: "accent", size: "sm" })}
                >
                  Open PDF
                  <ExternalLink aria-hidden />
                </a>
                <a
                  href={fileUrl(material, { download: true })}
                  className={buttonStyles({ variant: "subtle", size: "sm" })}
                >
                  Download
                </a>
              </div>
            </div>
          </PreviewFrame>
        </div>
      </>
    );
  }

  // Word and PowerPoint. Rendering these needs a conversion service; saying so
  // is more use than a viewer that shows a spinner and then a download link.
  return (
    <NoPreview
      Icon={FileText}
      title={`${KIND_LABELS[material.kind]} files open on your device`}
      description="Browsers cannot display Word or PowerPoint without converting them first. Acadify reads the text inside for reviewers and quizzes — this button gets you the original."
      material={material}
    />
  );
}

export { fileUrl };
