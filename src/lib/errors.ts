import { type Result } from "@/types";

/**
 * The error taxonomy.
 *
 * The distinction that matters: an EXPECTED failure is a value, returned as a
 * `Result` and rendered in place. An UNEXPECTED failure is thrown and caught by
 * an error boundary. Throwing for a quota limit or an invalid file would replace
 * a useful screen with an error page — see docs/architecture.md §6.
 */
export type AppErrorCode =
  /** Input failed validation at the boundary. */
  | "validation"
  /** No session, or the session expired. */
  | "unauthenticated"
  /** Signed in, but this row is not theirs. RLS is the real gate; this is the message. */
  | "forbidden"
  /** The thing does not exist, or was deleted while a tab was open. */
  | "not_found"
  /** Per-user AI or storage allowance is used up. */
  | "quota_exceeded"
  /** Too many requests in a window. */
  | "rate_limited"
  /** The file is not something we can read — wrong type, corrupt, image-only PDF. */
  | "unreadable_file"
  /** The material is not `ready` yet, so generation cannot run. */
  | "not_ready"
  /** The model answered, but not in the shape we require. */
  | "invalid_ai_output"
  /** The provider itself failed — timeout, 5xx, network. */
  | "provider_unavailable"
  /** Anything we did not anticipate. */
  | "unexpected";

/**
 * A failure a student will read.
 *
 * `message` says what happened. `nextStep` says what to do about it — it is
 * required, because an error without a next step is a dead end
 * (docs/states.md §5).
 */
export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly nextStep: string;
  /** Whether retrying the same operation could plausibly succeed. */
  readonly retryable: boolean;
  /** Non-user-facing context for logs. Never rendered. */
  readonly context?: Record<string, unknown>;

  constructor(opts: {
    code: AppErrorCode;
    message: string;
    nextStep: string;
    retryable?: boolean;
    context?: Record<string, unknown>;
    cause?: unknown;
  }) {
    super(opts.message, { cause: opts.cause });
    this.name = "AppError";
    this.code = opts.code;
    this.nextStep = opts.nextStep;
    this.retryable = opts.retryable ?? DEFAULT_RETRYABLE[opts.code];
    this.context = opts.context;
  }
}

const DEFAULT_RETRYABLE: Record<AppErrorCode, boolean> = {
  validation: false,
  unauthenticated: false,
  forbidden: false,
  not_found: false,
  quota_exceeded: false,
  rate_limited: true,
  unreadable_file: false,
  not_ready: true,
  invalid_ai_output: true,
  provider_unavailable: true,
  unexpected: true,
};

export function ok<T>(data: T): Result<T, AppError> {
  return { ok: true, data };
}

export function fail<T = never>(error: AppError): Result<T, AppError> {
  return { ok: false, error };
}

/**
 * Normalises anything thrown into an AppError with student-readable copy.
 *
 * Nothing that reaches a screen may carry a raw provider message or a stack
 * trace (NFR-R3, docs/states.md §5).
 */
export function toAppError(thrown: unknown): AppError {
  if (thrown instanceof AppError) return thrown;
  return new AppError({
    code: "unexpected",
    message: "Something went wrong on our side.",
    nextStep: "Try again in a moment. If it keeps happening, it is not you — it is us.",
    cause: thrown,
    context: { original: thrown instanceof Error ? thrown.message : String(thrown) },
  });
}

/** Ready-made errors for the cases that recur across features. */
export const errors = {
  unauthenticated: () =>
    new AppError({
      code: "unauthenticated",
      message: "You need to be signed in.",
      nextStep: "Sign in and we will bring you straight back here.",
    }),

  forbidden: () =>
    new AppError({
      code: "forbidden",
      message: "That is not yours to open.",
      nextStep: "Go back to your subjects.",
    }),

  notFound: (what = "That") =>
    new AppError({
      code: "not_found",
      message: `${what} no longer exists.`,
      nextStep: "It may have been deleted. Head back and refresh the list.",
    }),

  quotaExceeded: (used: number, limit: number, resetsAt: string) =>
    new AppError({
      code: "quota_exceeded",
      message: `You have used all ${limit} of today's AI generations.`,
      nextStep: `They reset at ${resetsAt}. Flashcards and reviewers you already have still work.`,
      context: { used, limit },
    }),

  unreadableFile: (reason: string, nextStep: string) =>
    new AppError({ code: "unreadable_file", message: reason, nextStep }),

  imageOnlyPdf: () =>
    new AppError({
      code: "unreadable_file",
      message: "This PDF has no readable text — it looks like a scan.",
      nextStep: "Try typing the key parts as notes instead, or upload a text-based copy.",
    }),

  notReady: () =>
    new AppError({
      code: "not_ready",
      message: "This material is still being read.",
      nextStep: "Give it a moment — you can leave this page and come back.",
    }),

  invalidAiOutput: () =>
    new AppError({
      code: "invalid_ai_output",
      message: "The generated content came back malformed.",
      nextStep: "Try generating it again.",
    }),

  providerUnavailable: () =>
    new AppError({
      code: "provider_unavailable",
      message: "The AI service is not responding right now.",
      nextStep: "Try again in a minute. Your question is still here.",
    }),
} as const;

/* -------------------------------------------------------------------------- */
/*  Error response standards (Sprint 17)                                       */
/* -------------------------------------------------------------------------- */

/**
 * The shape every route handler returns on failure.
 *
 * One shape, so a caller never has to guess whether the message is in `error`,
 * `message` or `detail`. `code` is for the caller to branch on; `message` and
 * `nextStep` are for a person to read, and neither ever carries a provider
 * string or a stack trace (NFR-R3, docs/states.md §5).
 */
export type ErrorBody = {
  error: {
    code: AppErrorCode;
    message: string;
    nextStep: string;
    /** Echoed back so a client can correlate a report with a server log. */
    requestId?: string;
  };
};

/** HTTP status per failure kind. Kept here so two handlers cannot disagree. */
const STATUS_BY_CODE: Record<AppErrorCode, number> = {
  validation: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  quota_exceeded: 429,
  rate_limited: 429,
  unreadable_file: 415,
  not_ready: 409,
  invalid_ai_output: 502,
  provider_unavailable: 503,
  unexpected: 500,
};

export function statusForError(error: AppError): number {
  return STATUS_BY_CODE[error.code];
}

/**
 * Turns anything thrown into the standard JSON response.
 *
 * Unexpected failures are logged with their cause and returned WITHOUT it —
 * the student gets the generic message from `toAppError`, and the detail stays
 * server-side where it belongs.
 */
export function errorResponse(thrown: unknown, requestId?: string): Response {
  const error = toAppError(thrown);

  if (error.code === "unexpected") {
    console.error("[pawgress] unexpected error", {
      requestId,
      cause: error.cause,
      context: error.context,
    });
  }

  const body: ErrorBody = {
    error: {
      code: error.code,
      message: error.message,
      nextStep: error.nextStep,
      ...(requestId ? { requestId } : {}),
    },
  };

  return Response.json(body, {
    status: statusForError(error),
    // A failure is never cacheable, and a 429 cached by a CDN would keep
    // rejecting a student long after their quota reset.
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * The same failure, as the state a Server Action form renders.
 *
 * Actions return rather than throw for expected failures — throwing would swap
 * a usable screen for an error boundary (docs/architecture.md §6).
 */
export function errorFormState(thrown: unknown): {
  status: "error";
  message: string;
  nextStep: string;
} {
  const error = toAppError(thrown);
  if (error.code === "unexpected") {
    console.error("[pawgress] unexpected error in action", { cause: error.cause });
  }
  return { status: "error", message: error.message, nextStep: error.nextStep };
}
