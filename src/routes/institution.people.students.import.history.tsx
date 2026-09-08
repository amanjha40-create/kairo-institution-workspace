import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, FileClock, Upload } from "lucide-react";
import { getInstitutionStudentRosterImportHistory } from "@/lib/institution/api";
import { useInstitutionAuth } from "@/lib/institution/auth";
import { getInstitutionErrorMessage, isInstitutionError } from "@/lib/institution/errors";
import { formatDateTime } from "@/lib/institution/format";
import { getInstitutionPermissions } from "@/lib/institution/permissions";
import { institutionQueryKeys } from "@/lib/institution/query-keys";
import { rosterIssueCount } from "@/lib/institution/roster";
import type { StudentRosterImportState } from "@/lib/institution/types";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PaginationState,
  PermissionDeniedState,
  ServiceUnavailableState,
} from "@/components/institution/PageStates";
import { StudentRosterImportStateBadge } from "@/components/institution/roster/StudentRosterBadges";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/institution/people/students/import/history")({
  component: StudentRosterImportHistoryPage,
});

const PAGE_SIZE = 25;

function StudentRosterImportHistoryPage() {
  const { session, isDemoMode } = useInstitutionAuth();
  const permissions = getInstitutionPermissions(session);
  const organizationId = session?.institutionId;
  const [page, setPage] = useState(1);
  const [state, setState] = useState<StudentRosterImportState | "all">("all");
  const filters = { state: state === "all" ? undefined : state, page, pageSize: PAGE_SIZE };
  const historyQuery = useQuery({
    queryKey: institutionQueryKeys.studentRosterImports(organizationId, filters),
    queryFn: () => {
      if (!organizationId) throw new Error("An active institution context is required.");
      return getInstitutionStudentRosterImportHistory(organizationId, filters);
    },
    enabled: Boolean(organizationId) && permissions.canImportStudentRoster && !isDemoMode,
  });

  useEffect(() => {
    if (historyQuery.data?.totalPages && page > historyQuery.data.totalPages) {
      setPage(historyQuery.data.totalPages);
    }
  }, [historyQuery.data?.totalPages, page]);

  if (!permissions.canImportStudentRoster) return <PermissionDeniedState />;
  if (isDemoMode) {
    return (
      <ServiceUnavailableState
        title="Import history is unavailable in Demo Mode"
        description="Connect to an institution backend to review student roster imports."
      />
    );
  }
  if (historyQuery.isError && isInstitutionError(historyQuery.error)) {
    if (historyQuery.error.status === 403) return <PermissionDeniedState />;
    if (historyQuery.error.status === 503) {
      return (
        <ServiceUnavailableState
          title="Import history is unavailable"
          description={getInstitutionErrorMessage(historyQuery.error)}
        />
      );
    }
  }

  const data = historyQuery.data;
  const totalPages = Math.max(data?.totalPages ?? 0, 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button variant="link" className="h-auto p-0 text-muted-foreground" asChild>
            <Link to="/institution/people/students">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to student roster
            </Link>
          </Button>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Student Import History</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review student roster uploads and their backend-confirmed results.
          </p>
        </div>
        <Button asChild>
          <Link to="/institution/people/students/import">
            <Upload className="h-4 w-4" aria-hidden="true" /> Import Students
          </Link>
        </Button>
      </div>

      <div className="flex justify-end">
        <Select
          value={state}
          onValueChange={(value) => {
            setState(value as StudentRosterImportState | "all");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[220px]" aria-label="Filter import history by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All import statuses</SelectItem>
            <SelectItem value="mapping_required">Mapping required</SelectItem>
            <SelectItem value="ready_for_review">Ready to import</SelectItem>
            <SelectItem value="completed">Import complete</SelectItem>
            <SelectItem value="completed_with_errors">Completed with issues</SelectItem>
            <SelectItem value="failed">Import failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {historyQuery.isLoading ? (
        <LoadingState />
      ) : historyQuery.isError ? (
        <ErrorState onRetry={() => historyQuery.refetch()} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={FileClock}
          title={state === "all" ? "No student imports yet" : "No imports match this status"}
          description={
            state === "all"
              ? "Your institution's student roster imports will appear here."
              : "Choose another status to review earlier imports."
          }
          action={
            state === "all" ? (
              <Button asChild>
                <Link to="/institution/people/students/import">Import Students</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-lg border border-border bg-white md:block">
            <table className="min-w-[900px] w-full text-sm">
              <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Filename
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Uploaded by
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Date
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Total rows
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Added
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Updated
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Issues
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map((item) => (
                  <tr key={item.id} className="hover:bg-secondary/40">
                    <td className="px-4 py-3">
                      <Link
                        to="/institution/people/students/import/$importId"
                        params={{ importId: item.id }}
                        className="font-medium text-foreground hover:text-[color:var(--kairo-navy)]"
                      >
                        {item.originalFilename}
                      </Link>
                      <div className="text-xs uppercase text-muted-foreground">
                        {item.sourceFormat}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{item.uploader.displayName}</div>
                      <div className="text-xs text-muted-foreground">{item.uploader.email}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDateTime(item.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <StudentRosterImportStateBadge state={item.state} />
                    </td>
                    <td className="px-4 py-3">{item.counts.totalRows}</td>
                    <td className="px-4 py-3">{item.counts.created}</td>
                    <td className="px-4 py-3">{item.counts.updated}</td>
                    <td className="px-4 py-3">{rosterIssueCount(item.counts)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {data.items.map((item) => (
              <Link
                key={item.id}
                to="/institution/people/students/import/$importId"
                params={{ importId: item.id }}
                className="block rounded-lg border border-border bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{item.originalFilename}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDateTime(item.createdAt)}
                    </div>
                  </div>
                  <StudentRosterImportStateBadge state={item.state} />
                </div>
                <dl className="mt-3 grid grid-cols-4 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Rows</dt>
                    <dd>{item.counts.totalRows}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Added</dt>
                    <dd>{item.counts.created}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Updated</dt>
                    <dd>{item.counts.updated}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Issues</dt>
                    <dd>{rosterIssueCount(item.counts)}</dd>
                  </div>
                </dl>
              </Link>
            ))}
          </div>

          <PaginationState
            page={data.page}
            totalPages={totalPages}
            pageSize={data.pageSize}
            total={data.total}
            itemLabel="imports"
            onPrevious={() => setPage((current) => Math.max(1, current - 1))}
            onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
            previousDisabled={data.page <= 1 || historyQuery.isFetching}
            nextDisabled={data.page >= totalPages || historyQuery.isFetching}
          />
        </>
      )}
    </div>
  );
}
