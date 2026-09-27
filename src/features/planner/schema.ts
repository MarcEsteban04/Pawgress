import { z } from "zod";
import { isDateKey } from "@/features/planner/dates";

/**
 * Planner events (FR-L1, US-J1, Sprint 60).
 *
 * The table has existed since Sprint 13 with exactly the six kinds the roadmap
 * lists; this is the application's side of it — what each kind means, and what
 * a valid event is.
 */

export const EVENT_KINDS = [
  "exam",
  "quiz",
  "assignment",
  "project",
  "presentation",
  "study_session",
] as const;

export type EventKind = (typeof EVENT_KINDS)[number];

/**
 * What each kind is, beyond its name.
 *
 * `assessed` separates things someone else will mark from time a student has
 * set aside for themselves. The study-plan engine (Sprint 65) plans revision
 * TOWARD the first kind; it would be absurd to plan revision toward a study
 * session. And `work` separates things handed IN from things SAT — an
 * assignment is finished early by doing it; an exam can only be prepared for.
 */
export const EVENT_KIND_INFO: Record<
  EventKind,
  { label: string; plural: string; assessed: boolean; work: boolean }
> = {
  exam: { label: "Exam", plural: "Exams", assessed: true, work: false },
  quiz: { label: "Quiz", plural: "Quizzes", assessed: true, work: false },
  assignment: { label: "Assignment", plural: "Assignments", assessed: true, work: true },
  project: { label: "Project", plural: "Projects", assessed: true, work: true },
  presentation: { label: "Presentation", plural: "Presentations", assessed: true, work: true },
  study_session: { label: "Study session", plural: "Study sessions", assessed: false, work: false },
};

export function isEventKind(value: string): value is EventKind {
  return (EVENT_KINDS as readonly string[]).includes(value);
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * A valid event, as the server will accept it.
 *
 * Mirrors the table's own constraints — title 1–300, notes up to 2000 — so a
 * student is told what is wrong in words, rather than meeting a CHECK
 * violation surfaced as "something went wrong". The date is checked as a REAL
 * date: `2026-02-30` has the right shape and would be rejected by Postgres
 * with an error nobody could act on.
 */
export const eventInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Give it a name.")
    .max(300, "Keep the name under 300 characters."),
  kind: z.enum(EVENT_KINDS),
  subjectId: z.string().uuid().nullable(),
  topicId: z.string().uuid().nullable(),
  dueOn: z.string().refine(isDateKey, "That is not a real date."),
  /* Optional, because most deadlines are a day, not a minute. Saying "11:59pm"
     on every assignment would be data entry for its own sake. */
  dueTime: z.string().regex(TIME, "Use a 24-hour time, like 14:30.").nullable(),
  notes: z.string().trim().max(2000, "Keep notes under 2000 characters.").nullable(),
});

export type EventInput = z.infer<typeof eventInputSchema>;
