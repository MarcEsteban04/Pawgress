import { Suspense } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, PanelBoundary, Skeleton } from "@/components/ui";
import { PlannerBoard } from "@/features/planner/components/PlannerBoard";
import { asCalendarSpan, daysFor, rangeFor, readQuery } from "@/features/planner/view";
import { groupDeadlines, listDeadlines, nextAssessed } from "@/server/planner/deadlines";
import { getStudentToday, listEvents } from "@/server/planner/queries";
import { listSubjects } from "@/server/subjects/queries";
import { listTopics } from "@/server/topics/queries";

/**
 * The academic planner (FR-L1, US-J1, Sprint 61).
 *
 * Sprint 60 built the data layer — six event kinds, validation, CRUD, and a
 * "today" that is the student's own rather than UTC's — and there was nothing
 * to click. This is the screen.
 *
 * **The range comes from the URL, and so does the fetch.** `?view` and `?date`
 * decide which days are on screen, `rangeFor` turns that into the window to
 * read, and the read is exactly that window — never a year filtered down. A
 * month grid deliberately asks for MORE than its month: it starts on the
 * Monday before the 1st, and fetching only the month would leave those leading
 * cells reliably, invisibly empty.
 *
 * **The deadline list is a different question and a different query** (Sprint
 * 62). It is everything still to do — no start, no end, overdue included —
 * scored against how ready the student is for each. Only one of the two runs
 * per request; `asCalendarSpan` is what makes "this view has no range" a type
 * rather than a convention.
 *
 * **Everything below the header is one Client Component.** A calendar is
 * click-to-edit in every cell, and threading a dialog through six server
 * components to keep the grid on the server would buy nothing: a month of one
 * student's deadlines is a few dozen rows.
 */

export const metadata = { title: "Planner" };

async function Board({ view, date }: { view?: string; date?: string }) {
  const today = await getStudentToday();
  const query = readQuery({ view, date }, today);
  /* Null for the deadline list, which is "everything still to do" rather than
     a window onto a range — so it reads a different query entirely. Typed as
     null rather than handled with a made-up range, which is the whole reason
     `CalendarSpan` is narrower than `PlannerView`. */
  const span = asCalendarSpan(query.view);

  const [events, deadlines, subjects] = await Promise.all([
    span ? listEvents(rangeFor(span, query.anchor)) : Promise.resolve([]),
    span ? Promise.resolve(null) : listDeadlines(),
    /* Every subject and its topics, so an event can be filed as it is
       written. Not a facet list: the point is filing something under a class
       that has nothing scheduled yet. Both queries are cached. */
    listSubjects().then((all) =>
      Promise.all(
        all.map(async (subject) => ({
          id: subject.id,
          name: subject.name,
          topics: (await listTopics(subject.id)).map((topic) => ({
            id: topic.id,
            name: topic.name,
          })),
        })),
      ),
    ),
  ]);

  return (
    <PlannerBoard
      view={query.view}
      anchor={query.anchor}
      today={today}
      days={span ? daysFor(span, query.anchor) : []}
      events={events}
      deadlines={
        deadlines ? { groups: groupDeadlines(deadlines), countdown: nextAssessed(deadlines) } : null
      }
      subjects={subjects}
    />
  );
}

function BoardSkeleton() {
  return (
    <Card>
      <CardBody className="flex flex-col gap-3 p-5">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-[26rem] w-full" />
      </CardBody>
    </Card>
  );
}

export default async function Page({ searchParams }: PageProps<"/planner">) {
  const resolved = await searchParams;
  const first = (key: string) => {
    const value = resolved[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const view = first("view");
  const date = first("date");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Exams, deadlines and study sessions"
        title="Planner"
        description="What you put here is what the dashboard counts down to, and what the study plan will schedule revision around. Click any day to add something to it."
      />

      <PanelBoundary title="Planner">
        {/* Keyed on the URL so paging shows the skeleton rather than the
            previous month frozen while the next one loads. */}
        <Suspense key={`${view ?? "month"}-${date ?? "today"}`} fallback={<BoardSkeleton />}>
          <Board view={view} date={date} />
        </Suspense>
      </PanelBoundary>
    </div>
  );
}
