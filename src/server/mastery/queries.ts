import "server-only";

import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSession } from "@/server/auth/session";
import {
  detectAttention,
  masteryBy,
  masteryOf,
  type Attention,
  type Difficulty,
  type Evidence,
  type Mastery,
} from "@/features/mastery/formula";

/**
 * Mastery, from the evidence (FR-P2, US-H1, Sprint 56).
 *
 * **One loader, cached per request, read by every screen that shows mastery.**
 * The dashboard, the Progress page, the subject hub and the topic list each
 * used to read the `progress` tally themselves; now each asks this, so all
 * four agree by construction — there is one set of answers and one formula.
 *
 * `progress` is no longer read by anything, and no longer written: see
 * `recordStudySessionAction` and `submitQuizAction`. Dropping the table is a
 * migration, and migrations are waiting on a working `SUPABASE_ACCESS_TOKEN`.
 */

/** PostgREST's default row cap. Read in pages of it, so a long history is not cut off. */
const PAGE = 1000;
const MAX_PAGES = 20;

export type TopicMastery = Mastery & {
  topicId: string;
  topicName: string;
  subjectId: string;
  subjectName: string;
  colorSlot: 1 | 2 | 3 | 4 | 5;
};

type Loaded = {
  evidence: Evidence[];
  topics: Map<string, { name: string; subjectId: string }>;
  subjects: Map<string, { name: string; colorSlot: 1 | 2 | 3 | 4 | 5 }>;
  /** One clock reading for every figure on the page. */
  now: number;
};

const toDifficulty = (value: string | null | undefined): Difficulty =>
  value === "easy" || value === "hard" ? value : "medium";

const load = cache(async (): Promise<Loaded> => {
  await requireSession();
  const supabase = await createSupabaseServerClient();

  const evidence: Evidence[] = [];
  const topics = new Map<string, { name: string; subjectId: string }>();
  const subjects = new Map<string, { name: string; colorSlot: 1 | 2 | 3 | 4 | 5 }>();

  /* Newest first, so if the page cap is ever hit it is the OLDEST history that
     is left out — which the formula weights least anyway. */
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data } = await supabase
      .from("quiz_answers")
      .select(
        "question_id, is_correct, answered_at, quiz_questions!inner(topic_id, topics(name), quizzes!inner(subject_id, difficulty, subjects(name, color_slot)))",
      )
      /* A null verdict is a question seen but never marked. It is not
         evidence of anything, least of all of being wrong. */
      .not("is_correct", "is", null)
      .order("answered_at", { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1);

    const rows = data ?? [];

    for (const row of rows) {
      const question = row.quiz_questions;
      const quiz = question?.quizzes;
      if (!question || !quiz) continue;

      evidence.push({
        questionId: row.question_id,
        topicId: question.topic_id,
        subjectId: quiz.subject_id,
        correct: row.is_correct === true,
        answeredAt: row.answered_at,
        difficulty: toDifficulty(quiz.difficulty),
      });

      if (question.topic_id && question.topics && !topics.has(question.topic_id)) {
        topics.set(question.topic_id, { name: question.topics.name, subjectId: quiz.subject_id });
      }
      if (quiz.subjects && !subjects.has(quiz.subject_id)) {
        subjects.set(quiz.subject_id, {
          name: quiz.subjects.name,
          colorSlot: (quiz.subjects.color_slot ?? 1) as 1 | 2 | 3 | 4 | 5,
        });
      }
    }

    if (rows.length < PAGE) break;
  }

  return { evidence, topics, subjects, now: Date.now() };
});

/** Every topic with any evidence, keyed by topic id. */
export const getTopicMastery = cache(async (): Promise<Map<string, TopicMastery>> => {
  const { evidence, topics, subjects, now } = await load();
  const scored = masteryBy(evidence, (answer) => answer.topicId, now);

  const result = new Map<string, TopicMastery>();
  for (const [topicId, mastery] of scored) {
    const topic = topics.get(topicId);
    if (!topic) continue;
    const subject = subjects.get(topic.subjectId);
    result.set(topicId, {
      ...mastery,
      topicId,
      topicName: topic.name,
      subjectId: topic.subjectId,
      subjectName: subject?.name ?? "",
      colorSlot: subject?.colorSlot ?? 1,
    });
  }
  return result;
});

/**
 * Every subject with any evidence, keyed by subject id.
 *
 * **Including answers that belong to no topic.** A whole-subject quiz written
 * before Sprint 53 tagged every question with a null topic, and those answers
 * are still genuine evidence about the SUBJECT. The old tally dropped them on
 * the floor; this counts them where they belong.
 */
export const getSubjectMastery = cache(async (): Promise<Map<string, Mastery>> => {
  const { evidence, now } = await load();
  return masteryBy(evidence, (answer) => answer.subjectId, now);
});

/**
 * Mastery across everything the student has answered.
 *
 * Scored over the whole body of evidence directly, not averaged from subjects
 * or topics: an average of subjects would let a subject with twelve answers
 * weigh as much as one with four hundred. One formula, one pool of answers.
 */
export const getOverallMastery = cache(async (): Promise<Mastery | null> => {
  const { evidence, now } = await load();
  return masteryOf(evidence, now);
});

/* -------------------------------------------------------------------------- */
/*  What needs practice (Sprint 59)                                            */
/* -------------------------------------------------------------------------- */

export type AttentionItem = Attention & {
  topicName: string;
  subjectId: string;
  subjectName: string;
  colorSlot: 1 | 2 | 3 | 4 | 5;
};

/**
 * The topics that need practice, most urgent first.
 *
 * Reads EVERY topic, not only the ones with answers, because "untested" can
 * only be found among the ones with none. Archived subjects are left out:
 * archiving is how a student says a class is over, and being told to revise it
 * would undo that.
 */
export const getAttention = cache(
  async ({ subjectId, limit = 5 }: { subjectId?: string; limit?: number } = {}): Promise<
    AttentionItem[]
  > => {
    const supabase = await createSupabaseServerClient();
    const [{ evidence, now }, { data: rows }] = await Promise.all([
      load(),
      (() => {
        let query = supabase
          .from("topics")
          .select(
            "id, name, subject_id, materials(count), subjects!inner(name, color_slot, archived_at)",
          )
          .is("subjects.archived_at", null);
        if (subjectId) query = query.eq("subject_id", subjectId);
        return query;
      })(),
    ]);

    const topics = rows ?? [];
    const named = new Map(topics.map((row) => [row.id, row]));

    return detectAttention({
      evidence,
      topics: topics.map((row) => ({
        id: row.id,
        hasMaterial: (row.materials?.[0]?.count ?? 0) > 0,
      })),
      now,
    })
      .slice(0, limit)
      .flatMap((attention) => {
        const row = named.get(attention.topicId);
        if (!row) return [];
        return [
          {
            ...attention,
            topicName: row.name,
            subjectId: row.subject_id,
            subjectName: row.subjects?.name ?? "",
            colorSlot: (row.subjects?.color_slot ?? 1) as 1 | 2 | 3 | 4 | 5,
          },
        ];
      });
  },
);
