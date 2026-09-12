import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, History, ListChecks } from "lucide-react";
import {
  confirmInstitutionStudentRoster,
  getInstitutionStudentRosterImportDetail,
  getInstitutionStudentRosterRows,
  saveInstitutionStudentRosterMapping,
} from "@/lib/institution/api";
import { useInstitutionAuth } from "@/lib/institution/auth";
import { getInstitutionErrorMessage, isInstitutionError } from "@/lib/institution/errors";
import { formatDateTime } from "@/lib/institution/format";
import { getInstitutionPermissions } from "@/lib/institution/permissions";
import { institutionQueryKeys } from "@/lib/institution/query-keys";
import {
  beginStudentRosterConfirmation,
  buildStudentRosterMappingAssignments,
  rosterIssueCount,
  studentRosterCanonicalFields,
  terminalStudentRosterImportStates,
} from "@/lib/institution/roster";
import type {
  StudentRosterImportRow,
  StudentRosterMappingAssignment,
} from "@/lib/institution/types";
import {
  ErrorState,
  LoadingState,
  NotFoundState,
  PaginationState,
  PermissionDeniedState,
  ServiceUnavailableState,
} from "@/components/institution/PageStates";
import { StudentRosterErrorReportButton } from "@/components/institution/roster/StudentRosterErrorReportButton";
import { StudentRosterImportStateBadge } from "@/components/institution/roster/StudentRosterBadges";
import { StudentRosterRows } from "@/components/institution/roster/StudentRosterRows";
import {
  StudentRosterPreviewSummary,
  StudentRosterResultSummary,
} from "@/components/institution/roster/StudentRosterSummary";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/institution/people/students/import/$importId")({
  component: StudentRosterImportDetailPage,
});

const ROW_PAGE_SIZE = 25;
const IGNORE_VALUE = "__ignore__";

function StudentRosterImportDetailPage() {
  const { importId } = Route.useParams();
  const queryClient = useQueryClient();
  const { session, isDemoMode } = useInstitutionAuth();
  const permissions = getInstitutionPermissions(session);
  const organizationId = session?.institutionId;
  const [page, setPage] = useState(1);
  const [disposition, setDisposition] = useState<StudentRosterImportRow["disposition"] | "all">(
    "all",
  );
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [mappingTouched, setMappingTouched] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const confirmStartedRef = useRef(false);

  const detailQuery = useQuery({
    queryKey: institutionQueryKeys.studentRosterImport(organizationId, importId),
    queryFn: () => {
      if (!organizationId) throw new Error("An active institution context is required.");
      return getInstitutionStudentRosterImportDetail(organizationId, importId);
    },
    enabled: Boolean(organizationId) && permissions.canImportStudentRoster && !isDemoMode,
    refetchInterval: (query) => {
      const state = query.state.data?.state;
      return state && ["uploaded", "parsing", "importing"].includes(state) ? 1_500 : false;
    },
  });

  const rowFilters = {
    disposition: disposition === "all" ? undefined : disposition,
    page,
    pageSize: ROW_PAGE_SIZE,
  };
  const rowsQuery = useQuery({
    queryKey: institutionQueryKeys.studentRosterImportRows(organizationId, importId, rowFilters),
    queryFn: () => {
      if (!organizationId) throw new Error("An active institution context is required.");
      return getInstitutionStudentRosterRows(organizationId, importId, rowFilters);
    },
    enabled: detailQuery.isSuccess && Boolean(organizationId),
  });

  useEffect(() => {
    if (!detailQuery.data || mappingTouched) return;
    const next: Record<string, string | null> = {};
    for (const column of detailQuery.data.mapping.sourceColumns) {
      next[column.normalized] = detailQuery.data.mapping.mappings[column.normalized] ?? null;
    }
    setMapping(next);
  }, [detailQuery.data, mappingTouched]);

  const mappingMutation = useMutation({
    mutationFn: (assignments: StudentRosterMappingAssignment[]) => {
      if (!organizationId) throw new Error("An active institution context is required.");
      return saveInstitutionStudentRosterMapping(organizationId, importId, assignments);
    },
    onSuccess: (result) => {
      queryClient.setQueryData(
        institutionQueryKeys.studentRosterImport(organizationId, importId),
        result,
      );
      queryClient.invalidateQueries({
        queryKey: institutionQueryKeys.studentRosterImportRows(organizationId, importId),
      });
      setMappingTouched(false);
      toast.success(result.state === "ready_for_review" ? "Mapping saved" : "Mapping updated");
    },
  });

  const confirmMutation = useMutation({
    mutationFn: () => {
      if (!organizationId) throw new Error("An active institution context is required.");
      return confirmInstitutionStudentRoster(organizationId, importId);
    },
    onSuccess: (result) => {
      queryClient.setQueryData(
        institutionQueryKeys.studentRosterImport(organizationId, importId),
        result,
      );
      queryClient.invalidateQueries({
        queryKey: institutionQueryKeys.studentRosterImportRows(organizationId, importId),
      });
      queryClient.invalidateQueries({
        queryKey: ["institution", "student-roster-imports", organizationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["institution", "student-roster", organizationId],
      });
      queryClient.invalidateQueries({ queryKey: ["institution", "people", organizationId] });
      setConfirmOpen(false);
      toast.success(
        result.state === "completed" ? "Students imported" : "Import completed with issues",
      );
    },
    onSettled: () => {
      confirmStartedRef.current = false;
    },
  });

  if (!permissions.canImportStudentRoster) return <PermissionDeniedState />;
  if (isDemoMode) {
    return (
      <ServiceUnavailableState
        title="Student import is unavailable in Demo Mode"
        description="Connect to an institution backend to review student imports."
      />
    );
  }
  if (detailQuery.isLoading) return <LoadingState />;
  if (detailQuery.isError && isInstitutionError(detailQuery.error)) {
    if (detailQuery.error.status === 403) return <PermissionDeniedState />;
    if (detailQuery.error.status === 404) return <NotFoundState />;
    if (detailQuery.error.status === 503) {
      return (
        <ServiceUnavailableState
          title="Student import is unavailable"
          description={getInstitutionErrorMessage(detailQuery.error)}
        />
      );
    }
  }
  if (detailQuery.isError || !detailQuery.data) {
    return <ErrorState onRetry={() => detailQuery.refetch()} />;
  }

  const detail = detailQuery.data;
  const terminal = terminalStudentRosterImportStates.has(detail.state);
  const canEditMapping = ["mapping_required", "ready_for_review"].includes(detail.state);
  const canConfirm = detail.state === "ready_for_review";
  const issues = rosterIssueCount(detail.counts);
  const rows = rowsQuery.data;
  const totalPages = Math.max(rows?.totalPages ?? 0, 1);
  const usedFields = new Set(
    Object.values(mapping).filter((value): value is string => Boolean(value)),
  );

  const saveMapping = () => {
    const assignments = buildStudentRosterMappingAssignments(detail.mapping.sourceColumns, mapping);
    mappingMutation.mutate(assignments);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button variant="link" className="h-auto p-0 text-muted-foreground" asChild>
            <Link to="/institution/people/students/import/history">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to import history
            </Link>
          </Button>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{detail.originalFilename}</h1>
            <StudentRosterImportStateBadge state={detail.state} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Uploaded {formatDateTime(detail.createdAt)}
            {detail.uploader ? ` by ${detail.uploader.displayName}` : ""}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/institution/people/students/import/history">
            <History className="h-4 w-4" aria-hidden="true" /> Import history
          </Link>
        </Button>
      </div>

      {detail.selectedSheetWarning && (
        <div
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          {detail.selectedSheetWarning}
        </div>
      )}

      {terminal ? (
        <section className="space-y-4 rounded-xl border border-border bg-secondary/30 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-6 w-6 text-cyan-700" aria-hidden="true" />
            <div>
              <h2 className="text-xl font-semibold">
                {detail.state === "completed"
                  ? "Import complete"
                  : detail.state === "failed"
                    ? "Import could not be completed"
                    : "Import completed with issues"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {detail.failureMessage ||
                  "The result below reflects the records accepted by the institution backend."}
              </p>
            </div>
          </div>
          <StudentRosterResultSummary counts={detail.counts} />
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/institution/people/students">View Students</Link>
            </Button>
            {issues > 0 && organizationId && (
              <StudentRosterErrorReportButton organizationId={organizationId} importId={importId} />
            )}
            <Button variant="outline" asChild>
              <Link to="/institution/people/students/import/history">View Import History</Link>
            </Button>
          </div>
        </section>
      ) : (
        <StudentRosterPreviewSummary counts={detail.counts} />
      )}

      {canEditMapping && (
        <section
          className="space-y-4 rounded-xl border border-border bg-white p-5 shadow-sm"
          aria-labelledby="column-mapping-heading"
        >
          <div>
            <h2 id="column-mapping-heading" className="text-lg font-semibold">
              Column mapping
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Match each file column to a KairoID field. Recognized columns are auto-mapped; choose
              Do not import for columns you do not need.
            </p>
          </div>

          {(detail.mapping.missingRequiredMappings.length > 0 ||
            detail.mapping.ambiguousMappings.length > 0) && (
            <div
              role="alert"
              className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            >
              {detail.mapping.missingRequiredMappings.includes("identity") && (
                <p>Map Student ID, Roll Number, or Institution Email.</p>
              )}
              {detail.mapping.missingRequiredMappings.includes("name") && (
                <p>Map Full Name, or map First Name and Last Name.</p>
              )}
              {detail.mapping.ambiguousMappings.length > 0 && (
                <p>Resolve ambiguous fields: {detail.mapping.ambiguousMappings.join(", ")}.</p>
              )}
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="min-w-[640px] w-full text-sm">
              <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Your file column
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    KairoID field
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {detail.mapping.sourceColumns.map((column) => {
                  const currentValue = mapping[column.normalized];
                  return (
                    <tr key={column.normalized}>
                      <th scope="row" className="px-4 py-3 text-left font-medium">
                        {column.original}
                      </th>
                      <td className="px-4 py-3">
                        <Select
                          value={currentValue || IGNORE_VALUE}
                          onValueChange={(value) => {
                            setMapping((current) => ({
                              ...current,
                              [column.normalized]: value === IGNORE_VALUE ? null : value,
                            }));
                            setMappingTouched(true);
                          }}
                        >
                          <SelectTrigger
                            aria-label={`Map ${column.original}`}
                            className="w-full max-w-xs"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={IGNORE_VALUE}>Do not import</SelectItem>
                            {studentRosterCanonicalFields.map((field) => (
                              <SelectItem
                                key={field.value}
                                value={field.value}
                                disabled={
                                  usedFields.has(field.value) && currentValue !== field.value
                                }
                              >
                                {field.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {detail.mapping.mappings[column.normalized] && !mappingTouched
                          ? "Auto-mapped"
                          : currentValue
                            ? "Mapped"
                            : "Ignored"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {mappingMutation.isError && (
            <div
              role="alert"
              aria-live="assertive"
              className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
            >
              {getInstitutionErrorMessage(mappingMutation.error)}
            </div>
          )}
          <div className="flex justify-end">
            <Button onClick={saveMapping} disabled={!mappingTouched || mappingMutation.isPending}>
              {mappingMutation.isPending ? "Saving mapping…" : "Save mapping"}
            </Button>
          </div>
        </section>
      )}

      <section className="space-y-4" aria-labelledby="preview-rows-heading">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="preview-rows-heading" className="text-lg font-semibold">
              {terminal ? "Import detail" : "Preview students"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Review row dispositions and structured issues before importing.
            </p>
          </div>
          <Select
            value={disposition}
            onValueChange={(value) => {
              setDisposition(value as StudentRosterImportRow["disposition"] | "all");
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[190px]" aria-label="Filter import rows">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All rows</SelectItem>
              <SelectItem value="valid_new">New</SelectItem>
              <SelectItem value="valid_update">Updates</SelectItem>
              <SelectItem value="duplicate">Duplicates</SelectItem>
              <SelectItem value="invalid">Invalid</SelectItem>
              <SelectItem value="skipped">Skipped</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {rowsQuery.isLoading ? (
          <LoadingState />
        ) : rowsQuery.isError ? (
          <ErrorState onRetry={() => rowsQuery.refetch()} />
        ) : !rows || rows.items.length === 0 ? (
          <div className="rounded-lg border border-border bg-white px-4 py-8 text-center text-sm text-muted-foreground">
            No rows match this filter.
          </div>
        ) : (
          <>
            <StudentRosterRows rows={rows.items} terminal={terminal} />
            <PaginationState
              page={rows.page}
              totalPages={totalPages}
              pageSize={rows.pageSize}
              total={rows.total}
              itemLabel="rows"
              onPrevious={() => setPage((current) => Math.max(1, current - 1))}
              onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
              previousDisabled={rows.page <= 1 || rowsQuery.isFetching}
              nextDisabled={rows.page >= totalPages || rowsQuery.isFetching}
            />
          </>
        )}
      </section>

      {!terminal && (
        <div className="sticky bottom-4 flex flex-col gap-3 rounded-xl border border-border bg-white/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2 text-sm">
            <ListChecks className="mt-0.5 h-4 w-4 text-cyan-700" aria-hidden="true" />
            <span>
              {detail.counts.validNew} new, {detail.counts.validUpdate} updates, and {issues} rows
              needing attention.
            </span>
          </div>
          <Button
            onClick={() => setConfirmOpen(true)}
            disabled={!canConfirm || confirmMutation.isPending}
          >
            {confirmMutation.isPending ? "Importing…" : "Import Students"}
          </Button>
        </div>
      )}

      {(confirmMutation.isError || detail.state === "failed") && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          {confirmMutation.isError
            ? getInstitutionErrorMessage(confirmMutation.error)
            : detail.failureMessage || "The import could not be completed."}
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import students?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-1">
              <span className="block">{detail.counts.validNew} new students will be added.</span>
              <span className="block">
                {detail.counts.validUpdate} existing students will be updated.
              </span>
              <span className="block">{issues} rows need attention and will not be imported.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirmMutation.isPending}>Back</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (!beginStudentRosterConfirmation(confirmStartedRef)) return;
                confirmMutation.mutate();
              }}
            >
              {confirmMutation.isPending ? "Importing…" : "Import Students"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
