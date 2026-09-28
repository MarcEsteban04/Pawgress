import { Suspense } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, PanelBoundary, Skeleton } from "@/components/ui";
import { PlannerBoard } from "@/features/planner/components/PlannerBoard";
import { daysFor, rangeFor, readQuery } from "@/features/planner/view";
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
 * **Everything below the header is one Client Component.** A calendar is
 * click-to-edit in every cell, and threading a dialog through six server
 * components to keep the grid on the server would buy nothing: a month of one
 * student's deadlines is a few dozen rows.
 */

export const metadata = { title: "Planner" };

async function Board({ view, date }: { view?: string; date?: string }) {
  const today = await getStudentToday();
  const query = readQuery({ view, date }, today);
  const range = rangeFor(query.view, query.anchor);

  const [events, subjects] = await Promise.all([
    listEvents(range),
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
      days={daysFor(query.view, query.anchor)}
      events={events}
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
