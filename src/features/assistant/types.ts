/**
 * Assistant message shapes, shared by the stream reader and the UI.
 *
 * Free of `server-only` and of anything DOM-shaped, so both halves can import
 * it — the same split as `materials/upload.ts`.
 */

export type AssistantCitation = {
  materialId: string;
  materialName: string;
  page: number | null;
};

export type ChatMessage =
  | { id: string; role: "user"; text: string }
  | {
      id: string;
      role: "assistant";
      /**
       * The question this answers.
       *
       * Carried on the message rather than inferred from the one before it: the
       * "answer without my material" retry needs it, and depending on array
       * order for that is the kind of assumption that breaks the first time a
       * message is inserted anywhere but the end.
       */
      question: string;
      text: string;
      citations: AssistantCitation[];
      /**
       * The row id, once the turn has been saved.
       *
       * Absent while an answer is streaming and for the moment after, because
       * the turn is written only once it finishes. Feedback needs it, so the
       * rating controls appear when it arrives rather than being disabled
       * before it.
       */
      storedId?: string;
      /** True while tokens are still arriving. */
      streaming: boolean;
      /** True when this answer was NOT grounded in the student's material. */
      ungrounded?: boolean;
      error?: { message: string; nextStep: string };
    };

/** One frame from the NDJSON stream. Mirrors the route handler's union. */
export type StreamFrame =
  | { type: "text"; value: string }
  | { type: "citations"; value: AssistantCitation[] }
  | { type: "ungrounded" }
  | { type: "error"; message: string; nextStep: string };

/**
 * Read an NDJSON stream frame by frame.
 *
 * Buffers across chunk boundaries, because a network chunk has no reason to end
 * on a newline — assuming it does is the bug that shows up only on slow
 * connections, which is exactly where it hurts most.
 */
export async function* readFrames(body: ReadableStream<Uint8Array>): AsyncGenerator<StreamFrame> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let newline = buffer.indexOf("\n");
      while (newline !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (line.length > 0) {
          try {
            yield JSON.parse(line) as StreamFrame;
          } catch {
            // A truncated frame is not worth taking the answer down for.
          }
        }
        newline = buffer.indexOf("\n");
      }
    }

    // A final frame with no trailing newline.
    const rest = buffer.trim();
    if (rest.length > 0) {
      try {
        yield JSON.parse(rest) as StreamFrame;
      } catch {
        /* ignore */
      }
    }
  } finally {
    reader.releaseLock();
  }
}
