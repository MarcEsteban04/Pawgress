"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { startTimedSessionAction } from "@/features/study/server/timer";
import { elapsedSeconds } from "@/features/study/timer";
import { type RunningSession, type SessionTarget } from "@/server/study/queries";
import { FinishSessionDialog } from "./FinishSessionDialog";
import { StartSessionDialog } from "./StartSessionDialog";

/**
 * The running study session, shared by everything that shows or starts one
 * (FR-N4, US-I3, Sprint 63).
 *
 * **Mounted in the app shell, so the clock outlives the page.** A student
 * starts a session, opens their reviewer, takes a quiz, asks Aki something —
 * and the session is still on the top bar the whole way, because the shell is
 * the one component that does not unmount on navigation. The SERVER holds the
 * actual session; this only draws it and opens the two dialogs.
 *
 * **One provider, not one per button.** The top bar and every planner row can
 * start a session, and all of them must agree that only one is running and
 * which one. Two copies of "is a session running" is how a planner row offers
 * Start while the top bar is showing 0:42.
 */

export type SessionPreset = { subjectId: string | null; topicId: string | null };

type DialogState =
  | { kind: "start"; preset: SessionPreset; error: string | null }
  | { kind: "finish"; notice: string | null }
  | null;

type StudySessionContext = {
  running: RunningSession | null;
  /** Seconds on the clock, ticking. Zero when nothing is running. */
  elapsed: number;
  targets: SessionTarget[];
  /** Open the Start dialog, optionally pre-filled. */
  openStart: (preset?: SessionPreset) => void;
  openFinish: () => void;
  /**
   * Start straight away, for a planned session whose subject is already
   * known. Falls back to the dialog when there is a choice still to make, or
   * to the running session when one is already on the clock.
   */
  startNow: (preset: SessionPreset) => void;
  starting: boolean;
};

const Context = createContext<StudySessionContext | null>(null);

/** Null outside the app shell — callers render nothing rather than throwing. */
export function useStudySession(): StudySessionContext | null {
  return useContext(Context);
}

export function StudySessionProvider({
  running,
  targets,
  children,
}: {
  running: RunningSession | null;
  targets: SessionTarget[];
  children: ReactNode;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [starting, startTransition] = useTransition();

  /**
   * The clock.
   *
   * The first frame is the server's reading, so server HTML and the hydrated
   * page agree. After that it ticks from the browser's clock, shifted by the
   * gap between the two — a laptop whose clock is three minutes fast should
   * not show a session three minutes longer than the one being recorded.
   *
   * `Math.max` with `readAt` covers the render where a NEW session has just
   * arrived and the ticking state still holds the previous one's time.
   */
  const [tick, setTick] = useState(running?.readAt ?? 0);
  useEffect(() => {
    if (!running) return;
    const skew = running.readAt - Date.now();
    const id = window.setInterval(() => setTick(Date.now() + skew), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const elapsed = running
    ? elapsedSeconds(Date.parse(running.startedAt), Math.max(tick, running.readAt))
    : 0;

  const openStart = useCallback((preset?: SessionPreset) => {
    setDialog({
      kind: "start",
      preset: preset ?? { subjectId: null, topicId: null },
      error: null,
    });
  }, []);

  const openFinish = useCallback(() => setDialog({ kind: "finish", notice: null }), []);

  const startNow = useCallback(
    (preset: SessionPreset) => {
      if (running) {
        setDialog({
          kind: "finish",
          notice: "One session at a time — finish this one, then start the next.",
        });
        return;
      }
      if (!preset.subjectId) {
        openStart(preset);
        return;
      }
      startTransition(async () => {
        const result = await startTimedSessionAction({
          subjectId: preset.subjectId!,
          topicId: preset.topicId,
        });
        if (result.status === "error") {
          setDialog({ kind: "start", preset, error: `${result.message} ${result.nextStep}` });
          return;
        }
        router.refresh();
      });
    },
    [running, openStart, router],
  );

  const value = useMemo(
    () => ({ running, elapsed, targets, openStart, openFinish, startNow, starting }),
    [running, elapsed, targets, openStart, openFinish, startNow, starting],
  );

  return (
    <Context.Provider value={value}>
      {children}

      <StartSessionDialog
        open={dialog?.kind === "start"}
        onOpenChange={(open) => !open && setDialog(null)}
        preset={dialog?.kind === "start" ? dialog.preset : null}
        initialError={dialog?.kind === "start" ? dialog.error : null}
        targets={targets}
      />

      {/* Kept mounted while a session runs, not only while open, so the
          "recorded" summary survives the refresh that removes the session it
          is summarising. The dialog clears its own result when closed. */}
      <FinishSessionDialog
        open={dialog?.kind === "finish"}
        onOpenChange={(open) => !open && setDialog(null)}
        running={running}
        elapsed={elapsed}
        notice={dialog?.kind === "finish" ? dialog.notice : null}
      />
    </Context.Provider>
  );
}
