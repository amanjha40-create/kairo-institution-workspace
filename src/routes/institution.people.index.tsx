import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { getInstitutionPeople } from "@/lib/institution/api";
import { useInstitutionAuth } from "@/lib/institution/auth";
import { ProfessionalInfoValue } from "@/components/institution/ProfessionalInfoValue";
import { getInstitutionErrorMessage, isInstitutionError } from "@/lib/institution/errors";
import { getInstitutionPermissions } from "@/lib/institution/permissions";
import { institutionQueryKeys } from "@/lib/institution/query-keys";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  InstitutionStatusBadge,
  PassportStatusBadge,
  TrustStatusBadge,
} from "@/components/institution/StatusBadge";
import {
  EmptyState,
  ErrorState,
  LoadingState,
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

function PeoplePage() {
  const { session } = useInstitutionAuth();
  const permissions = getInstitutionPermissions(session);
  const organizationId = session?.institutionId;
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<InstitutionStatus | "all">("all");
  const [verificationFilter, setVerificationFilter] = useState("all");
  const [programmeFilter, setProgrammeFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [graduationFilter, setGraduationFilter] = useState("all");

  const filters = useMemo(
    () => ({
      search: query || undefined,
      lifecycleStatus: statusFilter,
      verificationStatus: verificationFilter,
      programme: programmeFilter === "all" ? undefined : programmeFilter,
      department: departmentFilter === "all" ? undefined : departmentFilter,
      graduationPeriod: graduationFilter === "all" ? undefined : graduationFilter,
      pageSize: 100,
    }),
    [departmentFilter, graduationFilter, programmeFilter, query, statusFilter, verificationFilter],
  );

  const optionsQuery = useQuery({
    queryKey: institutionQueryKeys.people(organizationId, { pageSize: 100 }),
    queryFn: () => {
      if (!organizationId) {
        throw new Error("An active institution context is required.");
      }

      return getInstitutionPeople(organizationId, { pageSize: 100 });
    },
    enabled: Boolean(organizationId) && permissions.canViewPeople,
  });

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
  const filterSource = useMemo(
    () => optionsQuery.data?.items ?? data?.items ?? [],
    [data?.items, optionsQuery.data?.items],
  );

  const programmes = useMemo(
    () =>
      Array.from(
        new Set(filterSource.map((person) => person.relationship.programme).filter(Boolean)),
      ),
    [filterSource],
  );
  const departments = useMemo(
    () =>
      Array.from(
        new Set(filterSource.map((person) => person.relationship.department).filter(Boolean)),
      ),
    [filterSource],
  );
  const graduationPeriods = useMemo(
    () =>
      Array.from(
        new Set(filterSource.map((person) => person.relationship.graduationPeriod).filter(Boolean)),
      ),
    [filterSource],
  );

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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">People</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View students and alumni connected to your institution.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search name, student ID, programme, department…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as InstitutionStatus | "all")}
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
          <Select value={verificationFilter} onValueChange={setVerificationFilter}>
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
          <Select value={programmeFilter} onValueChange={setProgrammeFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Programme" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All programmes</SelectItem>
              {programmes.map((programme) => (
                <SelectItem key={programme} value={programme}>
                  {programme}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {departments.map((department) => (
                <SelectItem key={department} value={department}>
                  {department}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={graduationFilter} onValueChange={setGraduationFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Graduation" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All graduation</SelectItem>
              {graduationPeriods.map((period) => (
                <SelectItem key={period} value={period}>
                  {period}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
          {data.total > data.items.length && (
            <p className="text-xs text-muted-foreground">
              Showing the first {data.items.length} people out of {data.total}.
            </p>
          )}

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
                      <PassportStatusBadge status={person.passportStatus} />
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
                  <PassportStatusBadge status={person.passportStatus} />
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
