/* TYPE-ONLY imports, on purpose — the same rule as `dates.ts` and `urgency.ts`.
   `scripts/schedule-test.mjs` loads this file straight into Node with no build
   step, which only works while nothing here is a runtime import. Anything
   computed elsewhere (lead times, which kinds are "work") is passed IN. */
import type { Mastery, AttentionKind } from "@/features/mastery/formula";
import type { EventKind } from "./schema";

/**
 * Smart scheduling — which study sessions to plan, and on which days
 * (FR-N5, Sprint 64).
 *
 * **Suggestions, never entries.** This proposes; the student disposes. A
 * planner that writes into itself is a planner whose contents the student did
 * not choose, and a calendar full of sessions you did not choose is one you
 * stop reading. Every suggestion is one press from being a real planned
 * session, and nothing else.
 *
 * **This is the scheduling core, not a feature on its own.** Sprint 65's study
 * plan engine asks the same question at a finer grain — what to do TODAY — and
 * it must agree with this about what the week is for. So the rules live here,
 * once, as pure functions over inputs the product already observes:
 *
 *  1. **Demand** — how many sessions each thing needs, and in which window.
 *     An exam needs revision across its run-up (Sprint 62's lead days), more
 *     when the student is weak on it (Sprint 56's band). Work that is handed
 *     in needs working sessions, readiness or not. A topic flagged weak,
 *     slipping or stale (Sprint 59) needs one session even with nothing due.
 *  2. **Supply** — sessions a day the student has said they can do, minus the
 *     study sessions already in the planner.
 *  3. **Placement** — spread each item's sessions across its window (spacing
 *     beats cramming, which is the one thing about studying everyone agrees
 *     on), never two of the same subject on a day while another day has room,
 *     and never on the deadline's own day.
 *
 * What does not fit is COUNTED and reported, not silently dropped: "three
 * more sessions would not fit — raise sessions a day" is information; a
 * shorter list that hides it is a lie by omission.
 */

export type Band = Mastery["band"];

/** An upcoming deadline, as the scheduler needs to see it. */
export type ScheduleDeadline = {
  id: string;
  title: string;
  kind: EventKind;
  subjectId: string | null;
  subjectName: string | null;
  colorSlot: 1 | 2 | 3 | 4 | 5 | null;
  topicId: string | null;
  topicName: string | null;
  /** `YYYY-MM-DD`. */
  dueOn: string;
  /** Whole days from today. The scheduler ignores anything already due or past. */
  daysAway: number;
  /** Sprint 62's run-up for this kind. */
  leadDays: number;
  /** Handed in (assignment, project, presentation) rather than sat. */
  work: boolean;
  /** Something someone else will mark. Study sessions themselves are not. */
  assessed: boolean;
  readiness: Band | null;
  /** Sprint 62's pressure; decides who gets first pick of the days. */
  pressure: number;
};

/** A topic Sprint 59 flagged, most urgent first. */
export type ScheduleFocus = {
  topicId: string;
  topicName: string;
  subjectId: string;
  subjectName: string;
  colorSlot: 1 | 2 | 3 | 4 | 5;
  kind: AttentionKind;
  /** Days since it was last practised, for the "stale" reason. */
  daysSince: number | null;
};

/** A study session already in the planner inside the horizon, done or not. */
export type PlannedSlot = { dueOn: string; subjectId: string | null; topicId: string | null };

export type ScheduleInput = {
  /** The horizon, today first, as `YYYY-MM-DD` keys in order. */
  days: string[];
  deadlines: ScheduleDeadline[];
  focus: ScheduleFocus[];
  planned: PlannedSlot[];
  /** Sessions a day the student has said they can do. */
  perDay: number;
  /** Length of one session — the profile's study block. */
  minutes: number;
};

export type Suggestion = {
  /** Stable across renders for the same inputs, so React keeps rows in place. */
  key: string;
  dueOn: string;
  subjectId: string;
  subjectName: string;
  colorSlot: 1 | 2 | 3 | 4 | 5;
  topicId: string | null;
  topicName: string | null;
  minutes: number;
  /** What the planned session will be called. */
  title: string;
  /** Why, in one clause — the part only this product can write. */
  reason: string;
  /** The deadline it prepares for, if any. */
  forDeadline: string | null;
  /**
   * WHY this session exists, as a category rather than a sentence — what
   * Sprint 65's day plan reads to choose the activities inside it. A weak
   * topic is reviewed before it is practised; a strong one is confirmed with
   * a mock; an untested one is practised first, because a measurement is
   * what it lacks.
   */
  basis: Basis;
};

/**
 * The reason behind a session, as a category.
 *
 * Sprint 59's attention kinds when a specific flagged topic is the target;
 * Sprint 56's readiness band when it is a deadline revised as a whole; `work`
 * for time on something handed in, which is not studying in the sense the day
 * plan's activities mean.
 */
export type Basis = AttentionKind | Band | "work";

export type Schedule = {
  suggestions: Suggestion[];
  /** Sessions that were needed and did not fit in the days available. */
  unplaced: number;
};

/** Revision sessions across the WHOLE run-up of an exam, by readiness. */
const EXAM_SESSIONS: Record<Band, number> = {
  weak: 4,
  developing: 3,
  unmeasured: 3,
  strong: 1,
};

/** Working sessions for things handed in. Readiness says nothing about an essay. */
const WORK_SESSIONS: Partial<Record<EventKind, number>> = {
  project: 3,
  presentation: 2,
  assignment: 2,
};

/** Topic-only suggestions (nothing due) per horizon — enough to matter, few enough to read. */
export const MAX_FOCUS_SESSIONS = 3;

type Demand = {
  /** Who goes first when days are short. */
  priority: number;
  /** Indexes into `days` this demand may use. */
  window: number[];
  count: number;
  subjectId: string;
  subjectName: string;
  colorSlot: 1 | 2 | 3 | 4 | 5;
  /** One entry per session: the topic it targets (null = whole subject), and why. */
  targets: { topicId: string | null; topicName: string | null; reason: string; basis: Basis }[];
  title: (target: { topicName: string | null }) => string;
  forDeadline: string | null;
  source: string;
};

function countdown(daysAway: number): string {
  if (daysAway === 1) return "tomorrow";
  return `in ${daysAway} days`;
}

function focusReason(focus: ScheduleFocus): string {
  switch (focus.kind) {
    case "weak":
      return `you are weak on ${focus.topicName}`;
    case "slipping":
      return `${focus.topicName} is slipping`;
    case "stale":
      return focus.daysSince !== null
        ? `${focus.topicName} not practised in ${Math.round(focus.daysSince / 7)} weeks`
        : `${focus.topicName} not practised lately`;
    case "untested":
      return `${focus.topicName} has not been tested yet`;
  }
}

/**
 * How many of a deadline's sessions fall inside the horizon.
 *
 * The total is spread over the run-up that REMAINS — an exam in three days
 * with four sessions owed needs all four now, not 3/14ths of them — and the
 * horizon takes its share of that. Rounded up, so a run-up that has started
 * always yields at least one session this week rather than none.
 */
function horizonShare(total: number, remaining: number, overlap: number): number {
  if (overlap <= 0 || remaining <= 0) return 0;
  return Math.min(total, Math.ceil((total * overlap) / remaining));
}

export function suggestSessions(input: ScheduleInput): Schedule {
  const { days, perDay, minutes } = input;
  const demands: Demand[] = [];
  /* Topics a deadline's sessions already rotate through, so the same topic is
     not suggested a second time as a stand-alone "weak topic" session. */
  const coveredTopics = new Set<string>();
  /* Planned sessions per subject, to subtract from what each deadline needs. */
  const plannedBySubject = new Map<string, number>();
  for (const slot of input.planned) {
    if (slot.subjectId) {
      plannedBySubject.set(slot.subjectId, (plannedBySubject.get(slot.subjectId) ?? 0) + 1);
    }
  }
  const plannedTopics = new Set(input.planned.map((slot) => slot.topicId).filter(Boolean));

  /* ---- 1. Demand from deadlines ---------------------------------------- */

  const deadlines = input.deadlines
    .filter((deadline) => deadline.assessed && deadline.daysAway > 0 && deadline.subjectId)
    .sort((a, b) => b.pressure - a.pressure || a.dueOn.localeCompare(b.dueOn));

  for (const deadline of deadlines) {
    const subjectId = deadline.subjectId!;
    /* Days from max(today, due − lead) up to the day BEFORE it is due. The
       due day itself is for sitting the exam or handing the work in. */
    const window = days
      .map((day, index) => ({ day, index }))
      .filter(
        ({ day, index }) => day < deadline.dueOn && deadline.daysAway - index <= deadline.leadDays,
      )
      .map(({ index }) => index);
    if (window.length === 0) continue;

    const total = deadline.work
      ? (WORK_SESSIONS[deadline.kind] ?? 2)
      : Math.max(
          1,
          Math.ceil(
            EXAM_SESSIONS[deadline.readiness ?? "unmeasured"] *
              (deadline.kind === "quiz" ? 0.5 : 1),
          ),
        );
    const remaining = Math.min(deadline.leadDays, deadline.daysAway);
    let count = horizonShare(total, remaining, window.length);

    /* Already planned for this subject this week counts toward it — and is
       used up, so two exams in the same subject do not both claim it. */
    const planned = plannedBySubject.get(subjectId) ?? 0;
    const used = Math.min(planned, count);
    plannedBySubject.set(subjectId, planned - used);
    count -= used;
    if (count <= 0) continue;

    const due = `${deadline.title} ${countdown(deadline.daysAway)}`;
    let targets: Demand["targets"];

    if (deadline.work) {
      targets = Array.from({ length: count }, () => ({
        topicId: deadline.topicId,
        topicName: deadline.topicName,
        reason: `due ${countdown(deadline.daysAway)}`,
        basis: "work" as const,
      }));
    } else if (deadline.topicId) {
      const weak = deadline.readiness === "weak" ? ` · you are weak on ${deadline.topicName}` : "";
      targets = Array.from({ length: count }, () => ({
        topicId: deadline.topicId,
        topicName: deadline.topicName,
        reason: `${due}${weak}`,
        basis: deadline.readiness ?? "unmeasured",
      }));
    } else {
      /* A whole-subject exam: rotate through that subject's flagged topics,
         most urgent first, then revise the subject as a whole. Revising
         "Biology" in general when Genetics is the weak spot is the effort
         going where it is least needed. */
      const flagged = input.focus.filter((focus) => focus.subjectId === subjectId);
      targets = Array.from({ length: count }, (_, k) => {
        const focus = flagged[k];
        if (focus) {
          coveredTopics.add(focus.topicId);
          return {
            topicId: focus.topicId,
            topicName: focus.topicName,
            reason: `${due} · ${focusReason(focus)}`,
            basis: focus.kind,
          };
        }
        return {
          topicId: null,
          topicName: null,
          reason: due,
          basis: deadline.readiness ?? "unmeasured",
        };
      });
    }

    demands.push({
      priority: 1000 + deadline.pressure,
      window,
      count,
      subjectId,
      subjectName: deadline.subjectName ?? "",
      colorSlot: deadline.colorSlot ?? 1,
      targets,
      title: deadline.work
        ? () => `Work on ${deadline.title}`
        : (target) => `Revise ${target.topicName ?? deadline.subjectName ?? deadline.title}`,
      forDeadline: deadline.title,
      source: deadline.id,
    });
  }

  /* ---- 2. Demand from topics that need attention, with nothing due ------ */

  const allDays = days.map((_, index) => index);
  let focusCount = 0;
  input.focus.forEach((focus, rank) => {
    if (focusCount >= MAX_FOCUS_SESSIONS) return;
    if (coveredTopics.has(focus.topicId) || plannedTopics.has(focus.topicId)) return;
    focusCount += 1;
    demands.push({
      /* Below every deadline, in Sprint 59's own order. */
      priority: 100 - rank,
      window: allDays,
      count: 1,
      subjectId: focus.subjectId,
      subjectName: focus.subjectName,
      colorSlot: focus.colorSlot,
      targets: [
        {
          topicId: focus.topicId,
          topicName: focus.topicName,
          reason: focusReason(focus),
          basis: focus.kind,
        },
      ],
      title: (target) => `Practise ${target.topicName}`,
      forDeadline: null,
      source: `focus:${focus.topicId}`,
    });
  });

  /* ---- 3. Placement ----------------------------------------------------- */

  const load = days.map((day) => input.planned.filter((slot) => slot.dueOn === day).length);
  const subjectsOn = days.map(
    (day) =>
      new Set(
        input.planned
          .filter((slot) => slot.dueOn === day && slot.subjectId)
          .map((slot) => slot.subjectId!),
      ),
  );

  const suggestions: (Suggestion & { order: number })[] = [];
  let unplaced = 0;

  demands.sort((a, b) => b.priority - a.priority);

  for (const demand of demands) {
    for (let k = 0; k < demand.count; k++) {
      /* Where this session would sit if the window were empty: evenly spaced,
         each in the middle of its share of the window. */
      const ideal = demand.window[Math.floor(((k + 0.5) * demand.window.length) / demand.count)]!;

      let best: { index: number; cost: number } | null = null;
      for (const index of demand.window) {
        if (load[index]! >= perDay) continue;
        const cost =
          Math.abs(index - ideal) +
          /* A second session of the same subject on one day is allowed — an
             exam tomorrow may need it — but only once spreading has failed. */
          (subjectsOn[index]!.has(demand.subjectId) ? days.length : 0) +
          load[index]! * 0.5;
        if (!best || cost < best.cost || (cost === best.cost && index < best.index)) {
          best = { index, cost };
        }
      }

      if (!best) {
        unplaced += 1;
        continue;
      }

      const target = demand.targets[k] ?? demand.targets[demand.targets.length - 1]!;
      const day = days[best.index]!;
      load[best.index] += 1;
      subjectsOn[best.index].add(demand.subjectId);

      suggestions.push({
        key: `${demand.source}:${k}`,
        dueOn: day,
        subjectId: demand.subjectId,
        subjectName: demand.subjectName,
        colorSlot: demand.colorSlot,
        topicId: target.topicId,
        topicName: target.topicName,
        minutes,
        title: demand.title(target),
        reason: target.reason,
        forDeadline: demand.forDeadline,
        basis: target.basis,
        order: -demand.priority,
      });
    }
  }

  /* Day order for reading; within a day, the most pressing first. */
  suggestions.sort((a, b) => a.dueOn.localeCompare(b.dueOn) || a.order - b.order);
  return { suggestions: suggestions.map(({ order: _order, ...rest }) => rest), unplaced };
}

/* ------------------------------------------------------------------------ */
/*  Availability                                                            */
/* ------------------------------------------------------------------------ */

/**
 * Sessions a day, remembered in a cookie.
 *
 * FR-N5's "stated availability" belongs on the profile, beside the study block
 * it multiplies, and that is a migration — waiting, like every migration since
 * Sprint 49, on a renewed `SUPABASE_ACCESS_TOKEN`. Until then a cookie, the way
 * the sidebar is remembered: per device, which is the cost, and readable on the
 * server before first paint, which is why not `localStorage`.
 */
export const PER_DAY_COOKIE = "acadify-sessions-per-day";
export const PER_DAY_OPTIONS = [1, 2, 3] as const;
export const DEFAULT_PER_DAY = 2;

export function parsePerDay(value: string | undefined): number {
  const n = Number(value);
  return (PER_DAY_OPTIONS as readonly number[]).includes(n) ? n : DEFAULT_PER_DAY;
}

/** How far ahead suggestions look. A week is what anyone plans in. */
export const HORIZON_DAYS = 7;
