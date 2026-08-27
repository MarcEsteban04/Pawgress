import "server-only";

import { getAiService } from "@/lib/ai";
import { type Citation } from "@/lib/ai/types";
import { requireSessionOrFail } from "@/server/auth/session";
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
 * `grounded: false` with no answer, and the caller decides what to offer — which
 * per FR-C3 is an explicit, labelled choice to answer from general knowledge.
 * Making that decision here would take it away from the student.
 */

export type AnswerRequest = {
  question: string;
  scope?: RetrievalScope;
  /**
   * Set only when the student has explicitly asked for an answer that is not
   * from their material, having been told that is what they are getting.
   */
  allowUngrounded?: boolean;
};

export type AnswerResult =
  | {
      grounded: true;
      /** Streams to the caller; the citations resolve when it finishes. */
      textStream: AsyncIterable<string>;
      done: Promise<{ citations: Citation[] }>;
    }
  | {
      /** Retrieval found nothing relevant, and no ungrounded answer was asked for. */
      grounded: false;
      reason: "no_material" | "empty_question";
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

const UNGROUNDED_PROMPT = [
  "The student's own material does not cover this question, and they have asked",
  "for a general answer anyway.",
  "",
  "- Answer from general knowledge, accurately and briefly.",
  "- Open by making clear this is not from their material.",
  "- Do not claim their material says anything.",
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

  const retrieval = await retrieveForQuestion(question, request.scope);

  /* Nothing relevant, and no explicit request for a general answer. The caller
     gets the honest outcome and offers the choice; this does not make it. */
  if (retrieval.empty && !request.allowUngrounded) {
    return { grounded: false, reason: "no_material" };
  }

  const service = getAiService();
  const instruction = retrieval.empty ? UNGROUNDED_PROMPT : GROUNDED_PROMPT;

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
    `${instruction}\n\nQuestion: ${question}`,
    { context: retrieval.chunks },
  );

  return {
    grounded: true,
    textStream,
    /* Citations come from what retrieval actually returned, so they cannot
       disagree with what the model was shown. An ungrounded answer has none,
       which is exactly the signal the UI needs to label it. */
    done: done.then((result) => ({ citations: result.citations })),
  };
}
