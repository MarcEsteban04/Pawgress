import "server-only";

import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSession } from "@/server/auth/session";
import { dateKeyAt } from "@/features/planner/dates";
import {
  ACHIEVEMENTS,
  earnedFrom,
  kindOf,
  longestRun,
  READY_SCORE,
  turnedAround,
  type AchievementFacts,
  type AchievementKind,
} from "@/features/achievements/catalogue";
import { getAnswerEvidence, getTopicMastery } from "@/server/mastery/queries";
import { getProfile } from "@/server/profile/queries";
import { getSubjectReadiness } from "@/server/readiness/queries";
import { listSessionTargets } from "@/server/study/queries";

/**
 * Achievements — facts, grants and the list (Sprint 72).
 *
 * **Granted when work is RECORDED, never when a page is viewed.** The callers
 * are the actions that finish something: a practice set or deck, a quiz
 * hand-in, a timed session, a ticked plan block. That keeps `earned_at`
 * honest — it is when the thing happened, not when the student next looked —
 * and keeps page loads free of writes.
 *
 * **Read from the table, topped up from the facts.** A student who earned
 * something before this sprint existed has no row for it until their next
 * finished session; the list shows it as earned anyway, without a date, rather
 * than hiding a thing they did.
 */

const PAGE = 1000;
const MAX_PAGES = 20;

export const getAchievementFacts = cache(async (): Promise<AchievementFacts> => {
  await requireSession();
  const supabase = await createSupabaseServerClient();

  const sessions: { started_at: string; duration_seconds: number | null }[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data } = await supabase
      .from("study_sessions")
      .select("started_at, duration_seconds")
      .not("ended_at", "is", null)
      .order("started_at", { ascending: true })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    sessions.push(...(data ?? []));
    if ((data ?? []).length < PAGE) break;
  }

  const [quizzes, mocks, { data: plans }, evidence, mastery, readiness, targets, profile] =
    await Promise.all([
      /* Quizzes, not practice: a practice set's quiz row is linked to a
         reviewer; a quiz the student asked for is not. */
      supabase
        .from("quiz_attempts")
        .select("id, quizzes!inner(reviewer_id)", { count: "exact", head: true })
        .not("submitted_at", "is", null)
        .is("quizzes.reviewer_id", null),
      supabase
        .from("quiz_attempts")
        .select("id, quizzes!inner(is_mock_exam)", { count: "exact", head: true })
        .not("submitted_at", "is", null)
        .eq("quizzes.is_mock_exam", true),
      supabase.from("study_plans").select("study_plan_items(completed_at)"),
      getAnswerEvidence(),
      getTopicMastery(),
      getSubjectReadiness(),
      listSessionTargets(),
      getProfile(),
    ]);

  const names = new Map(targets.map((target) => [target.id, target.name]));

  return {
    sessions: sessions.length,
    totalMinutes: Math.round(
      sessions.reduce((sum, row) => sum + (row.duration_seconds ?? 0), 0) / 60,
    ),
    longestStreak: longestRun(
      sessions.map((row) => dateKeyAt(Date.parse(row.started_at), profile?.timezone)),
    ),
    quizzesHandedIn: quizzes.count ?? 0,
    mockExams: mocks.count ?? 0,
    fullPlanDays: (plans ?? []).filter((plan) => {
      const items = plan.study_plan_items ?? [];
      return items.length > 0 && items.every((item) => item.completed_at !== null);
    }).length,
    turnedAround: turnedAround(
      evidence.flatMap((answer) =>
        answer.topicId
          ? [{ topicId: answer.topicId, correct: answer.correct, answeredAt: answer.answeredAt }]
          : [],
      ),
      new Map(
        [...mastery.values()].map((topic) => [
          topic.topicId,
          { mastery: topic.mastery, questions: topic.questions, name: topic.topicName },
        ]),
      ),
    ),
    readySubjects: [...readiness.values()]
      .filter((row) => (row.readiness?.score ?? 0) >= READY_SCORE && names.has(row.subjectId))
      .map((row) => ({ subjectId: row.subjectId, subjectName: names.get(row.subjectId)! })),
    coveredSubjects: [...readiness.values()]
      .filter(
        (row) =>
          row.inputs.topics > 0 &&
          row.inputs.measuredTopics >= row.inputs.topics &&
          names.has(row.subjectId),
      )
      .map((row) => ({ subjectId: row.subjectId, subjectName: names.get(row.subjectId)! })),
  };
});

/**
 * Record anything newly earned. Called after finished work; never throws.
 *
 * Best-effort for the same reason the plan tick is: the work is already
 * recorded, and a badge granted on the next finished session instead of this
 * one is a smaller failure than a hand-in that errors over a badge.
 */
export async function grantAchievements(): Promise<void> {
  try {
    const session = await requireSession();
    const supabase = await createSupabaseServerClient();
    const earned = earnedFrom(await getAchievementFacts());
    if (earned.length === 0) return;

    /* `ignoreDuplicates`: the unique (user_id, code) turns a second grant
       into nothing, and the original `earned_at` stands. */
    await supabase.from("achievements").upsert(
      earned.map((item) => ({
        user_id: session.userId,
        code: item.code,
        metadata: item.metadata,
      })),
      { onConflict: "user_id,code", ignoreDuplicates: true },
    );
  } catch {
    /* See the header. */
  }
}

export type AchievementView = {
  code: string;
  kind: AchievementKind;
  /** The subject or topic a repeating one is for. */
  name: string | null;
  /** Null when earned before achievements were recorded — see the header. */
  earnedAt: string | null;
};

export type AchievementList = {
  earned: AchievementView[];
  /** Kinds not yet earned at all; repeating kinds stay here until the first. */
  ahead: AchievementKind[];
};

export const listAchievements = cache(async (): Promise<AchievementList> => {
  await requireSession();
  const supabase = await createSupabaseServerClient();

  const [{ data: rows }, facts] = await Promise.all([
    supabase.from("achievements").select("code, earned_at, metadata"),
    getAchievementFacts(),
  ]);

  const byCode = new Map<string, AchievementView>();
  for (const row of rows ?? []) {
    const kind = kindOf(row.code);
    if (!kind) continue;
    const metadata = (row.metadata ?? {}) as Record<string, unknown>;
    byCode.set(row.code, {
      code: row.code,
      kind,
      name: typeof metadata.name === "string" ? metadata.name : null,
      earnedAt: row.earned_at,
    });
  }
  for (const item of earnedFrom(facts)) {
    const kind = kindOf(item.code);
    if (!kind || byCode.has(item.code)) continue;
    byCode.set(item.code, {
      code: item.code,
      kind,
      name: typeof item.metadata.name === "string" ? item.metadata.name : null,
      earnedAt: null,
    });
  }

  const earned = [...byCode.values()].sort((a, b) =>
    (b.earnedAt ?? "").localeCompare(a.earnedAt ?? ""),
  );
  const earnedKinds = new Set(earned.map((item) => item.kind.code));

  return {
    earned,
    ahead: ACHIEVEMENTS.filter((kind) => !earnedKinds.has(kind.code)),
  };
});
