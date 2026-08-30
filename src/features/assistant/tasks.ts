/**
 * What a student is asking Aki to DO, not just what about (FR-C4, Sprint 38).
 *
 * "Explain this topic", "make it simpler" and "give me a hint" are different
 * jobs that happen to take the same input. One generic answer path handles them
 * badly in the same way every time: it explains at whatever level it chose, and
 * a student who needed a nudge gets the whole answer instead.
 *
 * Shared by the client and the server because both halves must agree on the
 * set. A task the UI can send and the server does not recognise falls back to a
 * plain answer, which is safe but silent — so the list lives in one place.
 */

export const ASSISTANT_TASKS = {
  /** The default. A direct answer to whatever was asked. */
  ask: "ask",
  /** Teach the topic from the beginning. */
  explain: "explain",
  /** Say the same thing in plainer words, shorter. */
  simplify: "simplify",
  /** Point toward the answer without giving it. */
  hint: "hint",
} as const;

export type AssistantTask = (typeof ASSISTANT_TASKS)[keyof typeof ASSISTANT_TASKS];

export function isAssistantTask(value: unknown): value is AssistantTask {
  return typeof value === "string" && value in ASSISTANT_TASKS;
}

/**
 * The instruction each task adds.
 *
 * Appended to the grounding instruction rather than replacing it, so a task
 * changes the SHAPE of the answer without touching the rule about where its
 * facts may come from. A "simpler" answer that quietly started inventing would
 * be a worse failure than a complicated one.
 */
export const TASK_INSTRUCTIONS: Record<AssistantTask, string | null> = {
  ask: null,

  explain: [
    "",
    "The student asked you to EXPLAIN this, so teach it rather than summarising:",
    "- Start from what it is and why it matters, before any detail.",
    "- Build up in order. Define a term the first time you use it.",
    "- Use one concrete example. A worked one beats a described one.",
    "- End with the single thing worth remembering.",
  ].join("\n"),

  simplify: [
    "",
    "The student asked for this in SIMPLER words. They have already read a",
    "harder version, so do not repeat it — say the same thing more plainly:",
    "- Short sentences. Everyday words. No jargon unless you define it inline.",
    "- Keep every fact. Simpler is not vaguer, and dropping the difficult half",
    "  is not simplifying, it is omitting.",
    "- An analogy is welcome if it is accurate. A wrong analogy is worse than a",
    "  hard sentence.",
  ].join("\n"),

  hint: [
    "",
    "The student asked for a HINT, which means they want to get there",
    "themselves. Do NOT give the answer:",
    "- Point at what to look at, or ask the question that unlocks it.",
    "- One or two sentences. A hint the length of an explanation is an",
    "  explanation.",
    "- If they say they are still stuck, then answer properly.",
  ].join("\n"),
};
