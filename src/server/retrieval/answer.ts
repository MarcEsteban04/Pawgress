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
 * `grounded: false` with no answer, and the caller decides what to offer — which
 * per FR-C3 is an explicit, labelled choice to answer from general knowledge.
 * Making that decision here would take it away from the student.
 */

/** How the library summary is introduced to the model. */
const LIBRARY_HEADING = "The student's library (their own account data, not file contents):";

/** What the model emits when the library summary cannot answer either. */
const SENTINEL = "NO_MATERIAL";

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

/**
 * When retrieval found nothing, but the library summary might still answer.
 *
 * "How many subjects do I have?" is not written in any passage — it is a fact
 * about the account, and vector search will never find it. So an empty
 * retrieval is no longer automatically "your material does not cover this": the
 * question gets one pass against the library summary first.
 *
 * The sentinel is how the model declines. Asking it to answer "if it can" and
 * inferring the rest from the prose would mean parsing an apology; a fixed
 * token it either emits or does not is unambiguous, and the caller turns it
 * back into the honest no-material outcome with its opt-in (FR-C3).
 */
const LIBRARY_PROMPT = [
  "None of the student's uploaded material matched this question, but you have",
  "a summary of their library above — their subjects, topics, and files.",
  "",
  "- If the question is about their library itself (how many subjects they have,",
  "  what they have uploaded, what a subject contains, what is still",
  "  processing), answer it from that summary. This is their own data, so",
  "  answering is correct and needs no disclaimer.",
  "- If the question is about the CONTENT of study material instead, you cannot",
  "  answer it: reply with exactly NO_MATERIAL and nothing else.",
  "- Never answer a content question from general knowledge here.",
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

  const [retrieval, libraryFacts] = await Promise.all([
    retrieveForQuestion(question, request.scope),
    buildLibraryFacts(),
  ]);

  const service = getAiService();

  /* Three modes, and the middle one is new. A student's own library is not
     general knowledge, so a question about it does not need the opt-in that a
     general answer does — but a question about MATERIAL that was not retrieved
     still does. */
  const libraryOnly = retrieval.empty && !request.allowUngrounded;
  const instruction = libraryOnly
    ? LIBRARY_PROMPT
    : retrieval.empty
      ? UNGROUNDED_PROMPT
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

  /* On the library-only path the first tokens decide whether this is an answer
     or a decline, so they are read before returning. It costs one round trip on
     a path that had none, and buys the difference between "you have one
     subject" and a shrug. */
  if (libraryOnly) {
    const iterator = textStream[Symbol.asyncIterator]();
    let head = "";
    while (head.length < SENTINEL.length + 4) {
      const next = await iterator.next();
      if (next.done) break;
      head += next.value;
    }

    if (head.trimStart().toUpperCase().startsWith(SENTINEL)) {
      return { grounded: false, reason: "no_material" };
    }

    return {
      grounded: true,
      textStream: (async function* () {
        if (head) yield head;
        while (true) {
          const next = await iterator.next();
          if (next.done) break;
          yield next.value;
        }
      })(),
      /* No citations: an answer about the library is grounded in the account,
         not in a page of a file, and inventing a source for it would be the
         one thing this product must never do. */
      done: done.then(() => ({ citations: [] })),
    };
  }

  return {
    grounded: true,
    textStream,
    /* Citations come from what retrieval actually returned, so they cannot
       disagree with what the model was shown. An ungrounded answer has none,
       which is exactly the signal the UI needs to label it. */
    done: done.then((result) => ({ citations: result.citations })),
  };
}
