import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { NoteEditor } from "@/features/notes/components/NoteEditor";
import { getSubject } from "@/server/subjects/queries";
import { listTopics } from "@/server/topics/queries";

/**
 * Write a new note (FR-U5, US-C3).
 *
 * A static segment beside `[materialId]`, which Next resolves first. There is no
 * collision risk: material ids are uuids, so no real material can ever be called
 * "new-note". Keeping notes inside the materials URL space is deliberate — a
 * note IS a material, and giving it a parallel `/notes/` tree would imply two
 * libraries where there is one.
 */

export async function generateMetadata({ params }: PageProps<"/subjects/[id]/materials/new-note">) {
  const { id } = await params;
  const subject = await getSubject(id);
  return { title: subject ? `New note · ${subject.name}` : "New note" };
}

export default async function Page({ params }: PageProps<"/subjects/[id]/materials/new-note">) {
  const { id } = await params;

  const [subject, topics] = await Promise.all([getSubject(id), listTopics(id)]);
  if (!subject) notFound();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <Link
        href={`/subjects/${id}/materials`}
        className="inline-flex w-fit items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Files
      </Link>

      <PageHeader
        eyebrow={subject.name}
        title="Write a note"
        description="Anything you type here is treated exactly like an uploaded file — it feeds the same reviewers, flashcards and quizzes."
      />

      <NoteEditor
        subjectId={id}
        topics={topics.map((topic) => ({ id: topic.id, name: topic.name }))}
      />
    </div>
  );
}
