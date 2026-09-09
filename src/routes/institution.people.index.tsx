import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Search, Upload, UsersRound } from "lucide-react";
import { getInstitutionPeople } from "@/lib/institution/api";
import { useInstitutionAuth } from "@/lib/institution/auth";
import { ProfessionalInfoValue } from "@/components/institution/ProfessionalInfoValue";
import { getInstitutionErrorMessage, isInstitutionError } from "@/lib/institution/errors";
import { getInstitutionPermissions } from "@/lib/institution/permissions";
import { institutionQueryKeys } from "@/lib/institution/query-keys";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InstitutionStatusBadge, TrustStatusBadge } from "@/components/institution/StatusBadge";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PaginationState,
  PermissionDeniedState,
  ServiceUnavailableState,
} from "@/components/institution/PageStates";
import type { InstitutionStatus } from "@/lib/institution/types";

export const Route = createFileRoute("/institution/people/")({
  component: PeoplePage,
});

const verificationStatuses = [
  { value: "all", label: "All verification" },
  { value: "not_started", label: "Not Started" },
  { value: "pending", label: "Pending" },
  { value: "verified", label: "Verified" },
  { value: "clarification_required", label: "Clarification Required" },
  { value: "discrepancy", label: "Discrepancy" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
] as const;

const PEOPLE_PAGE_SIZE = 25;

function PeoplePage() {
  const { session } = useInstitutionAuth();
  const permissions = getInstitutionPermissions(session);
  const organizationId = session?.institutionId;
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<InstitutionStatus | "all">("all");
  const [verificationFilter, setVerificationFilter] = useState("all");
  const [page, setPage] = useState(1);

  const filters = useMemo(
    () => ({
      search: query || undefined,
      lifecycleStatus: statusFilter,
      verificationStatus: verificationFilter,
      page,
      pageSize: PEOPLE_PAGE_SIZE,
    }),
    [page, query, statusFilter, verificationFilter],
  );

  const peopleQuery = useQuery({
    queryKey: institutionQueryKeys.people(organizationId, filters),
    queryFn: () => {
      if (!organizationId) {
        throw new Error("An active institution context is required.");
      }

      return getInstitutionPeople(organizationId, filters);
    },
    enabled: Boolean(organizationId) && permissions.canViewPeople,
  });

  const data = peopleQuery.data;
  const totalPages = Math.max(data?.totalPages ?? 0, 1);

  useEffect(() => {
    if (!data) {
      return;
    }

    if (data.totalPages > 0 && page > data.totalPages) {
      setPage(data.totalPages);
    }
  }, [data, page]);

  if (!permissions.canViewPeople) {
    return <PermissionDeniedState />;
  }

  if (
    peopleQuery.isError &&
    isInstitutionError(peopleQuery.error) &&
    peopleQuery.error.status === 403
  ) {
    return <PermissionDeniedState />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">People</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            View students and alumni connected to your institution.
          </p>
        </div>
        {permissions.canImportStudentRoster && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/institution/people/students">
                <UsersRound className="h-4 w-4" aria-hidden="true" />
                Student roster
              </Link>
            </Button>
            <Button asChild>
              <Link to="/institution/people/students/import">
                <Upload className="h-4 w-4" aria-hidden="true" />
                Import Students
              </Link>
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search name, student ID, programme, department…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value as InstitutionStatus | "all");
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Lifecycle" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All lifecycle</SelectItem>
              <SelectItem value="current_student">Current Student</SelectItem>
              <SelectItem value="alumni">Alumni</SelectItem>
              <SelectItem value="withdrawn">Withdrawn</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={verificationFilter}
            onValueChange={(value) => {
              setVerificationFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Verification" />
            </SelectTrigger>
            <SelectContent>
              {verificationStatuses.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">
          Programme, department, and graduation filter options are hidden until the backend returns
          authoritative filter metadata for the full institution directory.
        </p>
      </div>

      {peopleQuery.isLoading ? (
        <LoadingState />
      ) : peopleQuery.isError &&
        isInstitutionError(peopleQuery.error) &&
        peopleQuery.error.status === 503 ? (
        <ServiceUnavailableState
          title="People are unavailable"
          description={getInstitutionErrorMessage(peopleQuery.error)}
        />
      ) : peopleQuery.isError ? (
        <ErrorState onRetry={() => peopleQuery.refetch()} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title={query ? "No matching people" : "No connected people"}
          description={
            query
              ? "Try adjusting your search or filters."
              : "Students and alumni linked to your institution will appear here."
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>
              Showing {(data.offset || 0) + 1}-
              {Math.min((data.offset || 0) + data.items.length, data.total)} of {data.total} people
            </span>
            <span>
              Page {data.page} of {totalPages}
            </span>
          </div>

          <div className="hidden overflow-hidden rounded-lg border border-border bg-white md:block">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Person</th>
                  <th className="px-4 py-2 font-medium">Institution Status</th>
                  <th className="px-4 py-2 font-medium">Degree</th>
                  <th className="px-4 py-2 font-medium">Graduation</th>
                  <th className="px-4 py-2 font-medium">Current Title</th>
                  <th className="px-4 py-2 font-medium">Company</th>
                  <th className="px-4 py-2 font-medium">Verification</th>
                  <th className="px-4 py-2 font-medium">Passport</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map((person) => (
                  <tr key={person.id} className="hover:bg-secondary/40">
                    <td className="px-4 py-3">
                      <Link
                        to="/institution/people/$personId"
                        params={{ personId: person.id }}
                        search={{ rosterImportId: undefined, rosterRowNumber: undefined }}
                        className="font-medium text-foreground hover:text-[color:var(--kairo-navy)]"
                      >
                        {person.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {person.studentIdMasked ?? person.relationship.studentId}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <InstitutionStatusBadge status={person.institutionStatus} />
                    </td>
                    <td className="px-4 py-3">{person.degree}</td>
                    <td className="px-4 py-3 text-muted-foreground">{person.graduationYear}</td>
                    <td className="px-4 py-3">
                      <ProfessionalInfoValue
                        consented={person.sharedProfile.consented}
                        value={person.sharedProfile.currentTitle}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <ProfessionalInfoValue
                        consented={person.sharedProfile.consented}
                        value={person.sharedProfile.currentCompany}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <TrustStatusBadge status={person.trustStatus} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-muted-foreground">Summary on detail view</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {data.items.map((person) => (
              <Link
                key={person.id}
                to="/institution/people/$personId"
                params={{ personId: person.id }}
                search={{ rosterImportId: undefined, rosterRowNumber: undefined }}
                className="block rounded-lg border border-border bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{person.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {person.studentIdMasked ?? person.relationship.studentId}
                    </div>
                  </div>
                  <TrustStatusBadge status={person.trustStatus} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-muted-foreground">Degree</div>
                    <div>{person.degree}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Graduation</div>
                    <div>{person.graduationYear}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Current title</div>
                    <div>
                      <ProfessionalInfoValue
                        consented={person.sharedProfile.consented}
                        value={person.sharedProfile.currentTitle}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Company</div>
                    <div>
                      <ProfessionalInfoValue
                        consented={person.sharedProfile.consented}
                        value={person.sharedProfile.currentCompany}
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <InstitutionStatusBadge status={person.institutionStatus} />
                </div>
              </Link>
            ))}
          </div>

          <PaginationState
            page={data.page}
            totalPages={totalPages}
            pageSize={data.pageSize}
            total={data.total}
            itemLabel="people"
            onPrevious={() => setPage((current) => Math.max(1, current - 1))}
            onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
            previousDisabled={data.page <= 1 || peopleQuery.isFetching}
            nextDisabled={data.page >= totalPages || peopleQuery.isFetching}
          />
        </>
      )}
    </div>
  );
}
