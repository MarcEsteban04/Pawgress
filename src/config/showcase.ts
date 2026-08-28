/**
 * The example content shown on public pages — landing, sign-in, sign-up.
 *
 * Defined once because it had drifted: the same Programming/Recursion example
 * was hardcoded into four separate components, so every public surface led with
 * computer science. Acadify is for high school and college students across all
 * their subjects, and a visitor who only sees code examples reasonably concludes
 * it is not for them.
 *
 * Two rules for anything added here:
 *
 *  1. **Spread the subjects.** No single surface should lead with the same one,
 *     and across all of them every slot below should appear at least once.
 *  2. **Keep a subject's colour fixed.** `tone` is the categorical slot from
 *     `globals.css`; Biology is the same green here, on the dashboard, and in
 *     every list it ever appears in (docs/design-system.md §3).
 *
 * This is illustrative content, not sample *data*. It is marketing copy on
 * public pages, seen only by people who have no data of their own yet — it
 * never stands in for a student's real figures. The dashboard reads the real
 * database and shows empty states, and never borrows from here.
 */

export type ShowcaseTone = 1 | 2 | 3 | 4 | 5;

/** The fixed colour slot per subject, matching the categorical tokens in globals.css. */
export const SUBJECT_TONES = {
  programming: 1,
  history: 2,
  mathematics: 3,
  biology: 4,
  chemistry: 5,
} as const satisfies Record<string, ShowcaseTone>;

export type ShowcaseTopic = {
  subject: string;
  topic: string;
  tone: ShowcaseTone;
  /** 0–1. */
  value: number;
  questionCount: number;
};

/** Landing hero, "Today's plan" card. Leads with Chemistry. */
export const PLAN_TODAY: ShowcaseTopic[] = [
  {
    subject: "Chemistry",
    topic: "Titration",
    tone: SUBJECT_TONES.chemistry,
    value: 0.34,
    questionCount: 14,
  },
  {
    subject: "Biology",
    topic: "Genetics",
    tone: SUBJECT_TONES.biology,
    value: 0.62,
    questionCount: 28,
  },
  {
    subject: "Mathematics",
    topic: "Integration by parts",
    tone: SUBJECT_TONES.mathematics,
    value: 0.88,
    questionCount: 41,
  },
];

/** Landing hero, "Next exam" card. Leads with History. */
export const NEXT_EXAM_LANDING = {
  subject: "History",
  title: "Cold War & decolonisation",
  tone: SUBJECT_TONES.history,
  inDays: 4,
  readiness: 0.47,
  questionCount: 22,
} as const;

/** Sign-in aside. A different exam from the landing, so the two never twin. */
export const NEXT_EXAM_RESUME = {
  subject: "Mathematics",
  title: "Integration techniques",
  tone: SUBJECT_TONES.mathematics,
  inDays: 4,
  readiness: 0.51,
  questionCount: 33,
  plannedMinutes: 45,
} as const;

/** Sign-up aside: one topic holding them back, one already solid. */
export const PROOF_TOPICS: ShowcaseTopic[] = [
  {
    subject: "History",
    topic: "Cold War timeline",
    tone: SUBJECT_TONES.history,
    value: 0.33,
    questionCount: 18,
  },
  {
    subject: "Biology",
    topic: "Cell structure",
    tone: SUBJECT_TONES.biology,
    value: 0.88,
    questionCount: 22,
  },
];

/**
 * Landing, "A number you can argue with".
 *
 * The second row is deliberately a 4-question topic: it is the one place a
 * visitor sees `MasteryBar` withhold a percentage rather than print a confident
 * 100%, which is the product claim that section exists to make.
 */
export const EVIDENCE_TOPICS: ShowcaseTopic[] = [
  {
    subject: "Programming",
    topic: "Recursion",
    tone: SUBJECT_TONES.programming,
    value: 0.42,
    questionCount: 16,
  },
  {
    subject: "Biology",
    topic: "Photosynthesis",
    tone: SUBJECT_TONES.biology,
    value: 1,
    questionCount: 4,
  },
];

/** The handwritten note in the landing hero. */
export const STICKY_NOTE =
  "Chem ch. 7 titration + the Cold War slides — quiz me on both before Friday";

/** Citation shown beside generated content. */
export const CITATION = { material: "Chem ch. 7.pdf", page: 12 } as const;
