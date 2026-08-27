import { NextResponse, type NextRequest } from "next/server";
import { toAppError } from "@/lib/errors";
import { logAiError } from "@/lib/ai/log";
import { answerQuestion } from "@/server/retrieval/answer";

/**
 * The assistant's streaming endpoint (FR-C1, US-E1).
 *
 * **A route handler, not a Server Action** — the open question from
 * architecture.md §8, decided here. Two reasons, and the second is the one that
 * matters:
 *
 *  1. First-token latency is what this feature is judged on (NFR-F2), and a
 *     route handler streams bytes the browser can render the moment they
 *     arrive.
 *  2. **It can be aborted.** A student who navigates away, closes the tab, or
 *     hits stop should not keep paying for tokens they will never read. An
 *     `AbortController` on `fetch` propagates to the provider; a Server Action
 *     has no equivalent, and the generation would run to completion regardless.
 *
 * The wire format is newline-delimited JSON rather than Server-Sent Events.
 * SSE is the more standard choice, but `EventSource` cannot POST, so the client
 * would be reading the stream by hand either way — and NDJSON lets the citations
 * arrive as a typed frame AFTER the text, which is exactly when they are known.
 */

/** A long grounded answer is still a single response; this is a ceiling. */
export const maxDuration = 60;

type Frame =
  | { type: "text"; value: string }
  | { type: "citations"; value: unknown[] }
  /** Retrieval found nothing; the client offers the general-knowledge choice. */
  | { type: "no_material" }
  | { type: "error"; message: string; nextStep: string };

/** One NDJSON line, for the single-frame responses that carry no stream. */
function line(data: Frame): string {
  return JSON.stringify(data) + String.fromCharCode(10);
}

/** The same line as bytes, for enqueueing into the stream. */
function frame(data: Frame): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(data)}\n`);
}

export async function POST(request: NextRequest) {
  let body: { question?: unknown; subjectId?: unknown; allowUngrounded?: unknown };
  try {
    body = await request.json();
  } catch {
    return new NextResponse("Bad request", { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question : "";
  const subjectId = typeof body.subjectId === "string" && body.subjectId ? body.subjectId : null;
  const allowUngrounded = body.allowUngrounded === true;

  try {
    const result = await answerQuestion({
      question,
      scope: { subjectId },
      allowUngrounded,
    });

    if (!result.grounded) {
      /* 200, not an error status. "Your material does not cover this" is an
         answer, and dressing it as a failure would make the client treat a
         correct outcome as something to retry. */
      return new NextResponse(line({ type: "no_material" }), {
        status: 200,
        headers: streamHeaders(),
      });
    }

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const delta of result.textStream) {
            controller.enqueue(frame({ type: "text", value: delta }));
          }
          const { citations } = await result.done;
          controller.enqueue(frame({ type: "citations", value: citations }));
        } catch (thrown) {
          const error = toAppError(thrown);
          logAiError("assistant.stream", error);
          /* Sent as a frame rather than by aborting the response. The status
             line went out with the first byte, so an error mid-stream can only
             be reported in-band — and a student who has read half an answer
             deserves to be told it stopped rather than watching it hang. */
          controller.enqueue(
            frame({ type: "error", message: error.message, nextStep: error.nextStep }),
          );
        } finally {
          controller.close();
        }
      },
      cancel() {
        /* The student navigated away or pressed stop. Nothing to clean up here —
           the provider stream is garbage collected — but the usage row is still
           settled by `done` in the AI service, so an abandoned answer is still
           accounted for. Cancelling is not a way to get free tokens. */
      },
    });

    return new NextResponse(stream, { status: 200, headers: streamHeaders() });
  } catch (thrown) {
    const error = toAppError(thrown);
    /* Quota, rate limit and provider failures land here — before a single byte
       is sent, so they can still be a proper frame in a clean response. */
    logAiError("assistant.ask", error);
    return new NextResponse(
      line({ type: "error", message: error.message, nextStep: error.nextStep }),
      { status: 200, headers: streamHeaders() },
    );
  }
}

function streamHeaders(): HeadersInit {
  return {
    "Content-Type": "application/x-ndjson; charset=utf-8",
    "Cache-Control": "no-store",
    /* Proxies that buffer would defeat the point of streaming at all. */
    "X-Accel-Buffering": "no",
  };
}
