import { ArrowLeft, FileSearch, Upload } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { buttonStyles, Card, CardBody, EmptyState, PanelBoundary, Skeleton } from "@/components/ui";
import { MaterialFilters } from "@/features/materials/components/MaterialFilters";
import { MaterialRow } from "@/features/materials/components/MaterialRow";
import { UploadDialog } from "@/features/materials/components/UploadDialog";
import { isMaterialKind, isMaterialSort, isStatusFilter } from "@/features/materials/query";
import { listMaterialFacets, listMaterials } from "@/server/materials/queries";
import { getSubject } from "@/server/subjects/queries";
import { listTopics } from "@/server/topics/queries";

/**
 * The material library for one subject (FR-U4, US-C4).
 *
 * A page rather than a bigger panel on the subject hub. The hub answers "what
 * is going on with this class?" and its Materials panel is a preview; once a
 * student has forty files, searching and filtering them is its own task and
 * deserves its own URL — one they can link to, reload, and reach with the back
 * button.
 *
 * Filters live in the URL for the same reason they do on the subject list.
 */

export async function generateMetadata({ params }: PageProps<"/subjects/[id]/materials">) {
  const { id } = await params;
  const subject = await getSubject(id);
  return { title: subject ? `Files · ${subject.name}` : "Files" };
}

type Query = {
  search?: string;
  kind?: string;
  status?: string;
  topicId?: string;
  sort?: string;
};

async function MaterialList({
  subjectId,
  query,
  filtering,
}: {
  subjectId: string;
  query: Query;
  filtering: boolean;
}) {
  const [materials, topics] = await Promise.all([
    listMaterials(subjectId, {
      search: query.search,
      kind: isMaterialKind(query.kind) ? query.kind : undefined,
      status: isStatusFilter(query.status) ? query.status : undefined,
      topicId: query.topicId,
      sort: isMaterialSort(query.sort) ? query.sort : "recent",
    }),
    listTopics(subjectId),
  ]);

  /* Two empties, and telling them apart is the point. "Nothing uploaded" is
     onboarding and offers the action that fixes it; "nothing matched" is a dead
     search and offers a way back. Showing onboarding copy to someone with forty
     files and a typo would be actively wrong. */
  if (materials.length === 0 && filtering) {
    return (
      <EmptyState
        Icon={FileSearch}
        title="No files match"
        description={
          query.search
            ? `Nothing here is called “${query.search}”. Check the spelling, or clear the filters.`
            : "Nothing here matches those filters."
        }
        action={
          <Link
            href={`/subjects/${subjectId}/materials`}
            className={buttonStyles({ variant: "subtle" })}
          >
            Clear filters
          </Link>
        }
      />
    );
  }

  if (materials.length === 0) {
    return (
      <EmptyState
        Icon={Upload}
        title="No files yet"
        description="Lecture slides, notes and past papers go here. Everything Pawgress generates — reviewers, flashcards, quizzes — is built from them."
        action={<UploadDialog subjectId={subjectId} topics={topics} />}
      />
    );
  }

  return (
    <>
      <p className="text-sm text-ink-muted" role="status">
        {materials.length} {materials.length === 1 ? "file" : "files"}
        {filtering ? " matching" : ""}
      </p>

      <Card>
        <CardBody className="p-0">
          <ul className="divide-y divide-rule">
            {materials.map((material) => (
              <MaterialRow key={material.id} material={material} topics={topics} />
            ))}
          </ul>
        </CardBody>
      </Card>
    </>
  );
}

function ListSkeleton() {
  return (
    <Card>
      <CardBody className="flex flex-col gap-4 p-5">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </CardBody>
    </Card>
  );
}

export default async function Page({
  params,
  searchParams,
}: PageProps<"/subjects/[id]/materials">) {
  const { id } = await params;
  const resolved = await searchParams;

  const first = (key: string) => {
    const value = resolved[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const subject = await getSubject(id);

  /* RLS makes "not yours" and "does not exist" the same answer, and this
     renders the same 404 for both — telling a stranger that an id is real but
     off-limits is itself a leak. */
  if (!subject) notFound();

  const query: Query = {
    search: first("q"),
    kind: first("kind"),
    status: first("status"),
    topicId: first("topic"),
    sort: first("sort"),
  };

  const filtering = Boolean(query.search || query.kind || query.status || query.topicId);

  const [facets, topics] = await Promise.all([listMaterialFacets(id), listTopics(id)]);

  return (
    <div className="flex flex-col gap-5">
      <Link
        href={`/subjects/${id}`}
        className="inline-flex w-fit items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {subject.name}
      </Link>

      <PageHeader
        eyebrow="Everything you have uploaded"
        title="Files"
        description="Rename, re-file or remove anything here. Reviewers, flashcards and quizzes are built from these."
        action={<UploadDialog subjectId={id} topics={topics} />}
      />

      {/* Filters are furniture above an empty library. They appear once there
          is something to sort through, or once a filter is already applied —
          otherwise clearing the last one would remove the way to clear it. */}
      {(facets.total > 0 || filtering) && (
        <MaterialFilters
          kinds={facets.kinds}
          statuses={facets.statuses}
          topics={topics.map((topic) => ({ id: topic.id, name: topic.name }))}
        />
      )}

      <PanelBoundary title="Files">
        <Suspense
          key={`${query.search}-${query.kind}-${query.status}-${query.topicId}-${query.sort}`}
          fallback={<ListSkeleton />}
        >
          <MaterialList subjectId={id} query={query} filtering={filtering} />
        </Suspense>
      </PanelBoundary>
    </div>
  );
}
