import "server-only";

import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSession } from "@/server/auth/session";

/**
 * A factual summary of the student's own library, for the assistant.
 *
 * **Retrieval could not answer "how many subjects do I have?" and never could.**
 * Vector search finds passages that resemble a question; the answer to that one
 * is not written in any passage — it is a fact about the account. So the
 * assistant gets a second, separate context: not the contents of the files, but
 * the shape of the library holding them.
 *
 * This is NOT general knowledge and it is not a guess. It is the student's own
 * data, read through RLS, which is why answering from it does not need the
 * explicit opt-in that a general answer does (FR-C3).
 *
 * It stays SMALL on purpose. This block rides on every question, so its size is
 * a per-question cost — subject names and counts, not every file title in a
 * library of four hundred. Beyond a threshold the list is summarised rather
 * than enumerated, because a prompt that grows with the library is one that
 * eventually stops fitting.
 */

const MAX_LISTED_SUBJECTS = 25;
const MAX_LISTED_MATERIALS = 30;

export const buildLibraryFacts = cache(async (): Promise<string> => {
  await requireSession();
  const supabase = await createSupabaseServerClient();

  const [{ data: subjects }, { data: materials }, { data: topics }] = await Promise.all([
    supabase
      .from("subjects")
      .select("id, name, semester, academic_year, archived_at, created_at")
      .order("created_at", { ascending: true }),
    supabase
      .from("materials")
      .select("subject_id, title, kind, status, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("topics").select("subject_id, name").order("position", { ascending: true }),
  ]);

  const allSubjects = subjects ?? [];
  const active = allSubjects.filter((subject) => subject.archived_at === null);
  const archived = allSubjects.length - active.length;
  const allMaterials = materials ?? [];
  const allTopics = topics ?? [];

  if (active.length === 0) {
    return [
      "The student has no subjects yet.",
      "They have uploaded nothing, so there is no material to answer content questions from.",
    ].join("\n");
  }

  const lines: string[] = [];

  lines.push(
    `The student has ${active.length} active ${active.length === 1 ? "subject" : "subjects"}` +
      (archived > 0 ? `, plus ${archived} archived.` : "."),
  );
  lines.push(
    `Across them: ${allMaterials.length} uploaded ${allMaterials.length === 1 ? "file" : "files"} ` +
      `and ${allTopics.length} ${allTopics.length === 1 ? "topic" : "topics"}.`,
  );

  /* Processing state matters to a student asking why an answer is thin: a file
     that has not finished indexing cannot be searched yet, and saying so is
     more useful than an answer that quietly omits it. */
  const notReady = allMaterials.filter((material) => material.status !== "ready").length;
  if (notReady > 0) {
    lines.push(
      `${notReady} ${notReady === 1 ? "file is" : "files are"} still processing and cannot be searched yet.`,
    );
  }

  lines.push("", "Subjects:");
  for (const subject of active.slice(0, MAX_LISTED_SUBJECTS)) {
    const subjectTopics = allTopics.filter((topic) => topic.subject_id === subject.id);
    const subjectMaterials = allMaterials.filter((material) => material.subject_id === subject.id);
    const when = [
      subject.academic_year !== null
        ? `${subject.academic_year}–${subject.academic_year + 1}`
        : null,
      subject.semester,
    ]
      .filter(Boolean)
      .join(" ");

    lines.push(
      `- ${subject.name}${when ? ` (${when})` : ""}: ` +
        `${subjectMaterials.length} ${subjectMaterials.length === 1 ? "file" : "files"}, ` +
        `${subjectTopics.length} ${subjectTopics.length === 1 ? "topic" : "topics"}` +
        (subjectTopics.length > 0
          ? ` — ${subjectTopics
              .slice(0, 8)
              .map((topic) => topic.name)
              .join(", ")}`
          : ""),
    );
  }
  if (active.length > MAX_LISTED_SUBJECTS) {
    lines.push(`- …and ${active.length - MAX_LISTED_SUBJECTS} more.`);
  }

  if (allMaterials.length > 0) {
    lines.push("", "Most recently uploaded files:");
    for (const material of allMaterials.slice(0, MAX_LISTED_MATERIALS)) {
      const subject = allSubjects.find((entry) => entry.id === material.subject_id);
      lines.push(
        `- ${material.title} (${material.kind}${material.status !== "ready" ? `, ${material.status}` : ""})` +
          (subject ? ` in ${subject.name}` : ""),
      );
    }
    if (allMaterials.length > MAX_LISTED_MATERIALS) {
      lines.push(`- …and ${allMaterials.length - MAX_LISTED_MATERIALS} more.`);
    }
  }

  return lines.join("\n");
});
