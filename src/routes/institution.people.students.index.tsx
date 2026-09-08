import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useDeferredValue, useEffect, useState } from "react";
import { ArrowLeft, History, Search, Upload } from "lucide-react";
import { useInstitutionAuth } from "@/lib/institution/auth";
import { getInstitutionStudentRosterDirectory } from "@/lib/institution/api";
import { getInstitutionErrorMessage, isInstitutionError } from "@/lib/institution/errors";
import { formatDateTime } from "@/lib/institution/format";
import { getInstitutionPermissions } from "@/lib/institution/permissions";
import { institutionQueryKeys } from "@/lib/institution/query-keys";
import { rosterValue } from "@/lib/institution/roster";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PaginationState,
  PermissionDeniedState,
  ServiceUnavailableState,
} from "@/components/institution/PageStates";
import { OrganizationProvidedBadge } from "@/components/institution/roster/StudentRosterBadges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/institution/people/students/")({
  component: StudentRosterPage,
});

const PAGE_SIZE = 25;

function StudentRosterPage() {
  const { session, isDemoMode } = useInstitutionAuth();
  const permissions = getInstitutionPermissions(session);
  const organizationId = session?.institutionId;
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [page, setPage] = useState(1);
  const filters = { search: deferredSearch || undefined, page, pageSize: PAGE_SIZE };
  const rosterQuery = useQuery({
    queryKey: institutionQueryKeys.studentRoster(organizationId, filters),
    queryFn: () => {
      if (!organizationId) throw new Error("An active institution context is required.");
      return getInstitutionStudentRosterDirectory(organizationId, filters);
    },
    enabled: Boolean(organizationId) && permissions.canImportStudentRoster && !isDemoMode,
  });

  useEffect(() => {
    if (rosterQuery.data?.totalPages && page > rosterQuery.data.totalPages) {
      setPage(rosterQuery.data.totalPages);
    }
  }, [page, rosterQuery.data?.totalPages]);

  if (!permissions.canImportStudentRoster) return <PermissionDeniedState />;
  if (isDemoMode) {
    return (
      <ServiceUnavailableState
        title="Student roster is unavailable in Demo Mode"
        description="Connect to an institution backend to manage organization-provided students."
      />
    );
  }
  if (rosterQuery.isError && isInstitutionError(rosterQuery.error)) {
    if (rosterQuery.error.status === 403) return <PermissionDeniedState />;
    if (rosterQuery.error.status === 503) {
      return (
        <ServiceUnavailableState
          title="Student roster is unavailable"
          description={getInstitutionErrorMessage(rosterQuery.error)}
        />
      );
    }
  }

  const data = rosterQuery.data;
  const totalPages = Math.max(data?.totalPages ?? 0, 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button variant="link" className="h-auto p-0 text-muted-foreground" asChild>
            <Link to="/institution/people">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to People
            </Link>
          </Button>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Student roster</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Organization-provided student records imported by your institution.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to="/institution/people/students/import/history">
              <History className="h-4 w-4" aria-hidden="true" /> Import history
            </Link>
          </Button>
          <Button asChild>
            <Link to="/institution/people/students/import">
              <Upload className="h-4 w-4" aria-hidden="true" /> Import Students
            </Link>
          </Button>
        </div>
      </div>

      <div className="relative max-w-2xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Search student roster"
          className="pl-9"
          placeholder="Search name, student ID, email, program…"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
      </div>

      {rosterQuery.isLoading ? (
        <LoadingState />
      ) : rosterQuery.isError ? (
        <ErrorState onRetry={() => rosterQuery.refetch()} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title={deferredSearch ? "No matching students" : "No imported students"}
          description={
            deferredSearch
              ? "Try a different name, identifier, email, or programme."
              : "Import a CSV or XLSX roster to add organization-provided students."
          }
        />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-lg border border-border bg-white md:block">
            <table className="min-w-[900px] w-full text-sm">
              <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Student
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Student ID
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Program / Degree
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Department
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Enrollment
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Imported
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Source
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map((student) => (
                  <tr key={student.id} className="hover:bg-secondary/40">
                    <td className="px-4 py-3">
                      <Link
                        to="/institution/people/$personId"
                        params={{ personId: student.id }}
                        className="font-medium text-foreground hover:text-[color:var(--kairo-navy)]"
                      >
                        {student.fullName}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {student.email || "No email"}
                      </div>
                    </td>
                    <td className="px-4 py-3">{rosterValue(student.rosterData, "student_id")}</td>
                    <td className="px-4 py-3">
                      <div>{rosterValue(student.rosterData, "program")}</div>
                      <div className="text-xs text-muted-foreground">
                        {rosterValue(student.rosterData, "degree")}
                      </div>
                    </td>
                    <td className="px-4 py-3">{rosterValue(student.rosterData, "department")}</td>
                    <td className="px-4 py-3">
                      {rosterValue(student.rosterData, "enrollment_status")}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDateTime(student.importedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <OrganizationProvidedBadge />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {data.items.map((student) => (
              <Link
                key={student.id}
                to="/institution/people/$personId"
                params={{ personId: student.id }}
                className="block rounded-lg border border-border bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{student.fullName}</div>
                    <div className="break-all text-xs text-muted-foreground">
                      {student.email || "No email"}
                    </div>
                  </div>
                  <OrganizationProvidedBadge />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Student ID</dt>
                    <dd>{rosterValue(student.rosterData, "student_id")}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Enrollment</dt>
                    <dd>{rosterValue(student.rosterData, "enrollment_status")}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Program</dt>
                    <dd>{rosterValue(student.rosterData, "program")}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Department</dt>
                    <dd>{rosterValue(student.rosterData, "department")}</dd>
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
            itemLabel="students"
            onPrevious={() => setPage((current) => Math.max(1, current - 1))}
            onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
            previousDisabled={data.page <= 1 || rosterQuery.isFetching}
            nextDisabled={data.page >= totalPages || rosterQuery.isFetching}
          />
        </>
      )}
    </div>
  );
}
