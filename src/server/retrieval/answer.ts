import "server-only";

import { getAiService } from "@/lib/ai";
import { type Citation } from "@/lib/ai/types";
import { requireSessionOrFail } from "@/server/auth/session";
import { buildLibraryFacts } from "./library";
import { retrieveForQuestion, type RetrievalScope } from "./search";

/**
 * The RAG loop, end to end (FR-C1, FR-C3, FR-P6).
 *
 *   question → embedding → vector search → chunks → model → grounded answer
 *
 * This is the orchestration the roadmap's Sprint 36 diagram describes. The chat
 * interface around it is Sprint 37; keeping them apart means the loop can be
 * changed — reranking, a different floor, a second retrieval pass — without
 * touching a component, and the UI can be built without re-deciding any of this.
 *
 * **The empty case is the interesting one.** When retrieval finds nothing above
 * the relevance floor, this does NOT quietly ask the model anyway. It returns
 * **Aki answers. She does not refuse.** Until now an empty retrieval returned
 * nothing and asked the student to opt in to a general answer — which was the
 * right instinct applied too widely: it meant "Hello" was met with "your
 * material does not cover this".
 *
 * The value in the grounding rule was never the refusal. It was that a student
 * must never mistake general knowledge for their syllabus. That is a question
 * of ATTRIBUTION, and attribution is preserved exactly: an answer built from
 * their material carries its citations, and an answer that is not gets labelled
 * as general knowledge before its first sentence and in the UI (FR-C3). What
 * changes is that she stops being useless in between.
 */

/** How the library summary is introduced to the model. */
const LIBRARY_HEADING = "The student's library (their own account data, not file contents):";

export type AnswerRequest = {
  question: string;
  scope?: RetrievalScope;
  /**
   * Whether to search the student's files at all.
   *
   * False is not a weaker version of true — it skips retrieval entirely, so
   * there is no embedding call, no vector search, and a first token that
   * arrives as fast as the provider can produce one. A student who wants to
   * talk should not pay for a search they switched off, in latency or tokens.
   */
  useMaterial?: boolean;
};

export type AnswerResult =
  | {
      grounded: true;
      /**
       * True when the answer does NOT come from the student's uploaded files.
       *
       * The single most important flag in the product. It drives the label the
       * student sees, and it is set by what retrieval actually returned rather
       * than by what the model says about itself.
       */
      ungrounded: boolean;
      /** Streams to the caller; the citations resolve when it finishes. */
      textStream: AsyncIterable<string>;
      done: Promise<{ citations: Citation[] }>;
    }
  | {
      grounded: false;
      reason: "empty_question";
    };

const GROUNDED_PROMPT = [
  "Answer the student's question using only the material above.",
  "",
  "- If the material answers it, answer plainly and completely.",
  "- If the material only partly answers it, say what it does cover and what it",
  "  does not. A partial answer that admits its edges is useful; one that",
  "  pretends to be complete is not.",
  "- Refer to where something comes from in your own words when it helps",
  '  ("the lecture on mitosis covers this"). Do not fabricate a page number —',
  "  the sources are shown to the student separately.",
  "- Keep it to what a student short of time needs. No preamble.",
].join("\n");

/**
 * When no uploaded material matched.
 *
 * Covers three different things at once, and deliberately does not try to tell
 * them apart before answering: a greeting, a question about the library, and a
 * study question their files do not cover. Classifying them first would mean a
 * second model call to decide whether to make the first one.
 */
/**
 * The student turned material off. This is a conversation, not a search.
 *
 * Separate from GENERAL_PROMPT because the two situations are different: one
 * looked and found nothing, the other never looked. Telling someone "none of
 * your material matched" when nothing was searched would be a lie about work
 * that was never done.
 */
const CONVERSATION_PROMPT = [
  "The student has turned OFF searching their uploaded material for this",
  "conversation. Nothing was searched, so do not say anything about what their",
  "material does or does not contain.",
  "",
  "- Answer normally and helpfully, from general knowledge.",
  "- You still have the library summary above, so questions about their account",
  "  — how many subjects, what they have uploaded — are answerable from it.",
  "- If they ask about the CONTENT of their files, say plainly that searching",
  "  their material is switched off for this conversation, and that turning it",
  "  back on will let you answer from it.",
].join("\n");

const GENERAL_PROMPT = [
  "None of the student's uploaded material matched this question.",
  "",
  "- If it is conversational — a greeting, a thank you, asking what you can do —",
  "  just reply naturally. No disclaimer; there is nothing to attribute.",
  "- If it is about their library (how many subjects, what they have uploaded,",
  "  what is still processing), answer from the library summary above. That is",
  "  their own data, so no disclaimer either.",
  "- Otherwise answer from general knowledge, accurately and briefly, and open",
  "  by saying plainly that this is not from their material.",
  "- Never claim their material says anything.",
].join("\n");

/**
 * Ask a question of a student's material.
 *
 * Streamed, because first-token latency is what the assistant is judged on
 * (NFR-F2) and a grounded answer over eight chunks is not fast enough to wait
 * for in silence.
 */
export async function answerQuestion(request: AnswerRequest): Promise<AnswerResult> {
  const session = await requireSessionOrFail();

  const question = request.question.trim();
  if (question.length === 0) return { grounded: false, reason: "empty_question" };

  /* Retrieval is skipped, not merely ignored, when material is off. The
     embedding call it starts with is the slowest thing in the path and it is
     billed — running it to throw the result away would be paying for a search
     the student switched off. */
  const useMaterial = request.useMaterial !== false;

  const [retrieval, libraryFacts] = await Promise.all([
    useMaterial
      ? retrieveForQuestion(question, request.scope)
      : Promise.resolve({ chunks: [], empty: true as const, matched: 0 }),
    buildLibraryFacts(),
  ]);

  const service = getAiService();
  const instruction = !useMaterial
    ? CONVERSATION_PROMPT
    : retrieval.empty
      ? GENERAL_PROMPT
      : GROUNDED_PROMPT;

  const { textStream, done } = await service.stream(
    {
      userId: session.userId,
      task: "assistant",
      /* Every ask is its own call, deliberately — a student re-asking the same
         question after uploading more material must get a fresh answer, not a
         cached one from before the upload. This is the one place where reuse
         would be wrong rather than thrifty. */
      idempotencyKey: `ask:${session.userId}:${Date.now()}`,
    },
    `${LIBRARY_HEADING}\n${libraryFacts}\n\n${instruction}\n\nQuestion: ${question}`,
    { context: retrieval.chunks },
  );

  return {
    grounded: true,
    /* Set from what retrieval RETURNED, never from what the answer claims about
       itself. A model asked to disclose its own sourcing will sometimes forget;
       the empty chunk list cannot. */
    ungrounded: retrieval.empty,
    textStream,
    /* Citations come from what retrieval actually returned, so they cannot
       disagree with what the model was shown. An ungrounded answer has none,
       which is exactly the signal the UI needs to label it. */
    done: done.then((result) => ({ citations: result.citations })),
  };
}
