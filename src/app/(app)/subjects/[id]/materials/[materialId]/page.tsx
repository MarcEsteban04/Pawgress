import { ArrowLeft, Download, ExternalLink, Pencil, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { buttonStyles, Card, CardBody, SectionLabel, StatusBadge } from "@/components/ui";
import {
  DeleteMaterialDialog,
  RenameMaterialDialog,
} from "@/features/materials/components/MaterialActions";
import { fileUrl, MaterialPreview } from "@/features/materials/components/MaterialPreview";
import { formatBytes, KIND_LABELS } from "@/features/materials/upload";
import { getMaterial, getMaterialText } from "@/server/materials/queries";
import { getSubject } from "@/server/subjects/queries";
import { isTerminalStatus } from "@/types";

/**
 * One uploaded file (FR-U6, US-C6).
 *
 * Its own route rather than a dialog over the library, because a file is
 * content: a student wants to link to it, reload it, keep it open in a tab
 * beside their notes, and — from Sprint 36 — arrive here from a citation
 * pointing at a page (docs/navigation.md §1).
 *
 * The job this screen actually does is trust. Before a student relies on a
 * generated reviewer, they need to be able to check that Pawgress read the file
 * they think it read. That is why the preview gets the width and the metadata
 * sits beside it rather than above it.
 */

export async function generateMetadata({
  params,
}: PageProps<"/subjects/[id]/materials/[materialId]">) {
  const { materialId } = await params;
  const material = await getMaterial(materialId);
  return { title: material ? material.title : "File" };
}

/** One row of the metadata panel. */
function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5">
      <dt className="shrink-0 text-sm text-ink-muted">{label}</dt>
      <dd className="min-w-0 text-right text-sm font-medium">{children}</dd>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function Page({
  params,
  searchParams,
}: PageProps<"/subjects/[id]/materials/[materialId]">) {
  const { id, materialId } = await params;
  const resolved = await searchParams;

  const [material, subject] = await Promise.all([getMaterial(materialId), getSubject(id)]);

  /* Three ways to be a 404, one response. RLS makes "not yours" and "does not
     exist" indistinguishable on purpose; the third case is a real material
     under the wrong subject in the URL, which would render a breadcrumb that
     lies about where the file lives. */
  if (!material || !subject || material.subjectId !== id) notFound();

  /* A page hint from a citation. Clamped to the document, because a stale link
     pointing at page 400 of a 20-page PDF should open the file, not fail. */
  const rawPage = Array.isArray(resolved.page) ? resolved.page[0] : resolved.page;
  const parsedPage = rawPage ? Number.parseInt(rawPage, 10) : Number.NaN;
  const page =
    Number.isFinite(parsedPage) && parsedPage > 0
      ? Math.min(parsedPage, material.pageCount ?? parsedPage)
      : undefined;

  const canOpen = Boolean(material.storagePath);
  const isNote = material.kind === "note";

  /* Only notes carry their text into the page. `extracted_text` on an upload is
     a whole lecture deck, and the viewer shows the file itself rather than the
     extraction. */
  const noteBody = isNote ? await getMaterialText(materialId) : null;

  return (
    <div className="flex flex-col gap-5">
      <Link
        href={`/subjects/${id}/materials`}
        className="inline-flex w-fit items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Files
      </Link>

      <PageHeader
        eyebrow={subject.name}
        title={material.title}
        action={
          isNote ? (
            <Link
              href={`/subjects/${id}/materials/${materialId}/edit`}
              className={buttonStyles({ variant: "primary", size: "sm" })}
            >
              <Pencil aria-hidden />
              Edit note
            </Link>
          ) : canOpen ? (
            <div className="flex items-center gap-2">
              <a
                href={fileUrl(material, { page })}
                target="_blank"
                rel="noreferrer"
                className={buttonStyles({ variant: "subtle", size: "sm" })}
              >
                Open
                <ExternalLink aria-hidden />
              </a>
              <a
                href={fileUrl(material, { download: true })}
                className={buttonStyles({ variant: "primary", size: "sm" })}
              >
                <Download aria-hidden />
                Download
              </a>
            </div>
          ) : undefined
        }
      />

      {/* Preview takes the width; details sit beside it from xl up, and stack
          under it below that. */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
        <MaterialPreview material={material} page={page} noteBody={noteBody} />

        <div className="flex flex-col gap-4">
          <Card>
            <CardBody className="p-5">
              <SectionLabel>Details</SectionLabel>
              <dl className="mt-2 divide-y divide-rule">
                <Detail label="Type">{KIND_LABELS[material.kind]}</Detail>
                {material.byteSize !== null && (
                  <Detail label="Size">
                    <span className="tabular">{formatBytes(material.byteSize)}</span>
                  </Detail>
                )}
                {material.pageCount !== null && (
                  <Detail label="Pages">
                    <span className="tabular">{material.pageCount}</span>
                  </Detail>
                )}
                <Detail label="Uploaded">{formatDate(material.createdAt)}</Detail>
                <Detail label="Topic">
                  {material.topicName ? (
                    <Link
                      href={`/subjects/${id}/materials?topic=${material.topicId}`}
                      className="underline decoration-rule-strong underline-offset-2 hover:decoration-ink"
                    >
                      {material.topicName}
                    </Link>
                  ) : (
                    <span className="text-ink-subtle">Not filed</span>
                  )}
                </Detail>
                <Detail label="Status">
                  <StatusBadge status={material.status} />
                </Detail>
              </dl>

              {/* Processing is about making the text searchable, not about the
                  file being viewable — so this explains itself rather than
                  leaving a student wondering what is missing. */}
              {!isTerminalStatus(material.status) && (
                <p className="mt-3 text-xs leading-relaxed text-ink-subtle">
                  Pawgress is still reading this. The file itself is ready to view — reviewers and
                  quizzes become available once it finishes.
                </p>
              )}

              {material.failureMessage && (
                <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-bad">
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  <span>
                    {material.failureMessage} {material.failureNextStep}
                  </span>
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="flex flex-col gap-2 p-5">
              <SectionLabel>Manage</SectionLabel>
              <div className="mt-1 flex flex-wrap gap-2">
                <RenameMaterialDialog
                  material={material}
                  trigger={
                    <button
                      type="button"
                      className={buttonStyles({ variant: "subtle", size: "sm" })}
                    >
                      Rename
                    </button>
                  }
                />
                <DeleteMaterialDialog
                  material={material}
                  redirectTo={`/subjects/${id}/materials`}
                  trigger={
                    <button
                      type="button"
                      className={buttonStyles({ variant: "danger", size: "sm" })}
                    >
                      Delete
                    </button>
                  }
                />
              </div>
              <p className="mt-1 text-xs leading-relaxed text-ink-subtle">
                {isNote
                  ? "Renaming changes the title only — use Edit note to change what it says. Deleting is permanent."
                  : "Renaming changes the name in Pawgress only. Deleting removes the stored file, and there is no copy."}
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
