/**
 * SAMPLE DATA — not live, not seeded, not a fixture for tests.
 *
 * The dashboard is designed and built now (Sprint 07 shell + this redesign),
 * but the tables behind it do not exist until Sprint 13 and nothing writes to
 * them until Sprint 19+. Rather than ship an empty grid that cannot be judged,
 * every panel renders this set — and the page states plainly, on screen, that
 * the numbers are an example.
 *
 * Deleting this file is part of the definition of done for Sprint 70.
 */

import { type JobStatus } from "@/types";

/** Categorical slot 1–5. A subject keeps its slot everywhere it appears. */
export type Tone = 1 | 2 | 3 | 4 | 5;

export type SampleSubject = {
  id: string;
  name: string;
  tone: Tone;
  /** 0–1. */
  mastery: number;
  questionCount: number;
  topicCount: number;
};

export const SUBJECTS: SampleSubject[] = [
  { id: "bio", name: "Biology", tone: 4, mastery: 0.78, questionCount: 64, topicCount: 9 },
  { id: "math", name: "Mathematics", tone: 3, mastery: 0.61, questionCount: 48, topicCount: 7 },
  { id: "prog", name: "Programming", tone: 1, mastery: 0.44, questionCount: 37, topicCount: 8 },
  { id: "chem", name: "Chemistry", tone: 5, mastery: 0.86, questionCount: 52, topicCount: 6 },
  { id: "hist", name: "History", tone: 2, mastery: 0.33, questionCount: 21, topicCount: 5 },
];

export type PlanBlock = {
  id: string;
  subject: string;
  tone: Tone;
  topic: string;
  minutes: number;
  /** Review -> practice -> quiz, the shape of one study block. */
  parts: string;
  done: boolean;
  /** Why the planner chose this, in one clause. Never "recommended for you". */
  because: string;
};

export const PLAN: Record<"today" | "tomorrow", PlanBlock[]> = {
  today: [
    {
      id: "p1",
      subject: "Programming",
      tone: 1,
      topic: "Recursion",
      minutes: 45,
      parts: "10m review · 20m practice · 15m quiz",
      done: false,
      because: "Weakest topic before Friday's exam",
    },
    {
      id: "p2",
      subject: "History",
      tone: 2,
      topic: "Cold War timeline",
      minutes: 30,
      parts: "15m review · 15m flashcards",
      done: false,
      because: "Only 21 questions answered so far",
    },
    {
      id: "p3",
      subject: "Mathematics",
      tone: 3,
      topic: "Integration by parts",
      minutes: 30,
      parts: "10m review · 20m practice",
      done: true,
      because: "Quiz tomorrow",
    },
    {
      id: "p4",
      subject: "Biology",
      tone: 4,
      topic: "Genetics",
      minutes: 20,
      parts: "20m practice",
      done: false,
      because: "Due for a spaced review",
    },
  ],
  tomorrow: [
    {
      id: "q1",
      subject: "Mathematics",
      tone: 3,
      topic: "Series convergence",
      minutes: 40,
      parts: "15m review · 25m practice",
      done: false,
      because: "Quiz results land tonight",
    },
    {
      id: "q2",
      subject: "Programming",
      tone: 1,
      topic: "Big-O notation",
      minutes: 35,
      parts: "10m review · 25m quiz",
      done: false,
      because: "Exam in 3 days",
    },
    {
      id: "q3",
      subject: "Chemistry",
      tone: 5,
      topic: "Titration",
      minutes: 25,
      parts: "25m flashcards",
      done: false,
      because: "Keeping a strong topic strong",
    },
  ],
};

/**
 * Topics grouped by mastery band. Ordered weak -> strong, which is the order
 * the ordinal ramp is applied in.
 */
export const MASTERY_BANDS = [
  { label: "Not started", value: 7, step: "none" as const },
  { label: "Weak", value: 6, step: 1 as const },
  { label: "Developing", value: 9, step: 2 as const },
  { label: "Solid", value: 8, step: 3 as const },
  { label: "Strong", value: 5, step: 4 as const },
];

/**
 * Both series are percentages, which is the only reason they may share an axis.
 * Series a is average mastery across all topics; series b is average quiz score.
 *
 * One dataset per range, because a range switcher that relabels the same six
 * points is a lie about what changed.
 */
export type TrendRange = "week" | "month" | "all";

export const TREND: Record<TrendRange, { label: string; a: number; b: number }[]> = {
  week: [
    { label: "Mon", a: 0.6, b: 0.62 },
    { label: "Tue", a: 0.61, b: 0.58 },
    { label: "Wed", a: 0.61, b: 0.7 },
    { label: "Thu", a: 0.63, b: 0.66 },
    { label: "Fri", a: 0.63, b: 0.74 },
    { label: "Sat", a: 0.64, b: 0.71 },
    { label: "Sun", a: 0.64, b: 0.69 },
  ],
  month: [
    { label: "W1", a: 0.57, b: 0.6 },
    { label: "W2", a: 0.59, b: 0.55 },
    { label: "W3", a: 0.62, b: 0.68 },
    { label: "W4", a: 0.64, b: 0.69 },
  ],
  all: [
    { label: "Mar", a: 0.31, b: 0.44 },
    { label: "Apr", a: 0.38, b: 0.49 },
    { label: "May", a: 0.44, b: 0.47 },
    { label: "Jun", a: 0.52, b: 0.58 },
    { label: "Jul", a: 0.57, b: 0.71 },
    { label: "Aug", a: 0.64, b: 0.69 },
  ],
};

export const TREND_RANGES: { value: TrendRange; label: string }[] = [
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "all", label: "All time" },
];

export function isTrendRange(value: string | undefined): value is TrendRange {
  return value === "week" || value === "month" || value === "all";
}

export type UpcomingItem = {
  id: string;
  title: string;
  subject: string;
  tone: Tone;
  kind: "Exam" | "Quiz" | "Assignment" | "Project";
  /** Days from today. 0 is today. */
  inDays: number;
  /** 0–1 readiness for this event, or null when there is not enough evidence. */
  readiness: number | null;
};

export const UPCOMING: UpcomingItem[] = [
  {
    id: "u1",
    title: "Recursion & complexity",
    subject: "Programming",
    tone: 1,
    kind: "Exam",
    inDays: 4,
    readiness: 0.44,
  },
  {
    id: "u2",
    title: "Integration techniques",
    subject: "Mathematics",
    tone: 3,
    kind: "Quiz",
    inDays: 1,
    readiness: 0.61,
  },
  {
    id: "u3",
    title: "Cell division lab report",
    subject: "Biology",
    tone: 4,
    kind: "Assignment",
    inDays: 6,
    readiness: null,
  },
];

export type WeakTopic = {
  id: string;
  topic: string;
  subject: string;
  tone: Tone;
  mastery: number;
  questionCount: number;
  /** The concrete thing that went wrong, from the student's own answers. */
  missed: string;
};

export const WEAK_TOPICS: WeakTopic[] = [
  {
    id: "w1",
    topic: "Recursion",
    subject: "Programming",
    tone: 1,
    mastery: 0.31,
    questionCount: 16,
    missed: "Base cases — 5 of 6 missed questions were about when recursion stops.",
  },
  {
    id: "w2",
    topic: "Cold War timeline",
    subject: "History",
    tone: 2,
    mastery: 0.38,
    questionCount: 12,
    missed: "Ordering events between 1961 and 1968.",
  },
  {
    id: "w3",
    topic: "Inheritance patterns",
    subject: "Biology",
    tone: 4,
    mastery: 0.51,
    questionCount: 14,
    missed: "Telling co-dominance and incomplete dominance apart.",
  },
];

export type LibraryItem = {
  id: string;
  name: string;
  subject: string;
  tone: Tone;
  status: JobStatus;
  detail?: string;
};

export const LIBRARY: LibraryItem[] = [
  { id: "m1", name: "Lecture 9 — Recursion.pdf", subject: "Programming", tone: 1, status: "ready" },
  {
    id: "m2",
    name: "Ch. 4 problem set.docx",
    subject: "Mathematics",
    tone: 3,
    status: "embedding",
  },
  {
    id: "m3",
    name: "Cold War slides.pptx",
    subject: "History",
    tone: 2,
    status: "failed",
    detail: "Scanned pages — no text found",
  },
];

/** Headline figures for the stat row. */
export const HEADLINE = {
  readiness: 0.72,
  studiedThisWeekMinutes: 284,
  streakDays: 6,
  topicsTracked: MASTERY_BANDS.reduce((sum, band) => sum + band.value, 0),
};
