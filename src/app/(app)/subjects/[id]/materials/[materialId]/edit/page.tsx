import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { NoteEditor } from "@/features/notes/components/NoteEditor";
import { getMaterial, getMaterialText } from "@/server/materials/queries";
import { getSubject } from "@/server/subjects/queries";
import { listTopics } from "@/server/topics/queries";

/**
 * Edit a note (FR-U5, US-C3).
 *
 * Only notes are editable. An uploaded file's text is whatever the extractor
 * read from bytes we did not write, so letting a student edit it would produce a
 * material whose "extracted" text no longer matches the file every citation
 * points at. Replacing the upload is the honest way to change it — so this route
 * redirects rather than 404s, since the material does exist.
 */

export async function generateMetadata({
  params,
}: PageProps<"/subjects/[id]/materials/[materialId]/edit">) {
  const { materialId } = await params;
  const material = await getMaterial(materialId);
  return { title: material ? `Editing ${material.title}` : "Edit note" };
}

export default async function Page({
  params,
}: PageProps<"/subjects/[id]/materials/[materialId]/edit">) {
  const { id, materialId } = await params;

  const [material, subject] = await Promise.all([getMaterial(materialId), getSubject(id)]);

  if (!material || !subject || material.subjectId !== id) notFound();
  if (material.kind !== "note") redirect(`/subjects/${id}/materials/${materialId}`);

  const [body, topics] = await Promise.all([getMaterialText(materialId), listTopics(id)]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <Link
        href={`/subjects/${id}/materials/${materialId}`}
        className="inline-flex w-fit items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {material.title}
      </Link>

      <PageHeader eyebrow={subject.name} title="Edit note" />

      <NoteEditor
        subjectId={id}
        topics={topics.map((topic) => ({ id: topic.id, name: topic.name }))}
        note={{
          id: material.id,
          title: material.title,
          body: body ?? "",
          topicId: material.topicId,
        }}
      />
    </div>
  );
}
