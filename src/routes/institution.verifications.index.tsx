import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { getInstitutionOrganizationVerificationRequests } from "@/lib/institution/api";
import { useInstitutionAuth } from "@/lib/institution/auth";
import { getInstitutionErrorMessage, isInstitutionError } from "@/lib/institution/errors";
import { getInstitutionPermissions } from "@/lib/institution/permissions";
import { institutionQueryKeys } from "@/lib/institution/query-keys";
import { getVerificationStatusCategory } from "@/lib/institution/verification";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  VerificationPriorityBadge,
  VerificationStatusBadge,
} from "@/components/institution/StatusBadge";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PermissionDeniedState,
  ServiceUnavailableState,
} from "@/components/institution/PageStates";
import { formatDate } from "@/lib/institution/format";
import type {
  InstitutionVerificationInboxFilters,
  VerificationPriority,
  VerificationRequestType,
  VerificationStatus,
} from "@/lib/institution/types";

export const Route = createFileRoute("/institution/verifications/")({
  component: VerificationsPage,
});

const SUMMARY = [
  { key: "pending", label: "Pending" },
  { key: "in_progress", label: "In Progress" },
  { key: "awaiting_clarification", label: "Awaiting Clarification" },
  { key: "completed", label: "Completed" },
] as const;

function isBackendStatusFilter(
  value: (typeof SUMMARY)[number]["key"],
): value is Exclude<(typeof SUMMARY)[number]["key"], "completed"> {
  return value !== "completed";
}

function VerificationsPage() {
  const { session } = useInstitutionAuth();
  const permissions = getInstitutionPermissions(session);
  const organizationId = session?.institutionId;
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<VerificationStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<VerificationPriority | "all">("all");
  const [requestTypeFilter, setRequestTypeFilter] = useState<VerificationRequestType | "all">(
    "all",
  );
  const [assignedToMe, setAssignedToMe] = useState(false);
  const [sortBy, setSortBy] = useState<InstitutionVerificationInboxFilters["sortBy"]>("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const filters = useMemo(
    () => ({
      search: query.trim() || undefined,
      status: statusFilter,
      priority: priorityFilter,
      requestType: requestTypeFilter,
      assignedToMe,
      sortBy,
      sortOrder,
      page,
      pageSize: 25,
    }),
    [assignedToMe, page, priorityFilter, query, requestTypeFilter, sortBy, sortOrder, statusFilter],
  );

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: institutionQueryKeys.verificationInbox(organizationId, filters),
    queryFn: () => {
      if (!organizationId) {
        throw new Error("An active institution context is required.");
      }

      return getInstitutionOrganizationVerificationRequests(organizationId, filters);
    },
    enabled: Boolean(organizationId),
  });

  const summaryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    (data?.items ?? []).forEach((request) => {
      const category = getVerificationStatusCategory(request.status);
      counts[category] = (counts[category] ?? 0) + 1;
    });
    return counts;
  }, [data]);

  if (!permissions.canViewVerificationRequests) {
    return <PermissionDeniedState />;
  }

  if (isError && isInstitutionError(error) && error.status === 403) {
    return <PermissionDeniedState />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Verification Requests
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review education verification requests routed to your institution workspace.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SUMMARY.map((item) => {
          const isFilterable = isBackendStatusFilter(item.key);
          const active = isFilterable && statusFilter === item.key;

          return (
            <button
              key={item.key}
              type="button"
              disabled={!isFilterable}
              onClick={() => {
                if (!isFilterable) return;
                setStatusFilter(active ? "all" : item.key);
                setPage(1);
              }}
              className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                active
                  ? "border-[color:var(--kairo-navy)] bg-white shadow-sm"
                  : "border-border bg-white"
              } ${isFilterable ? "hover:border-[color:var(--kairo-teal)]" : "cursor-default"}`}
            >
              <div className="text-xs font-medium text-muted-foreground">{item.label}</div>
              <div className="mt-1 text-xl font-semibold text-foreground">
                {summaryCounts[item.key] ?? 0}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search candidate, claim, reference…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value as VerificationStatus | "all");
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Array.from(new Set((data?.items ?? []).map((request) => request.status))).map(
                (status) => (
                  <SelectItem key={status} value={status}>
                    <VerificationStatusOption status={status} />
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
          <Select
            value={priorityFilter}
            onValueChange={(value) => {
              setPriorityFilter(value as VerificationPriority | "all");
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priority</SelectItem>
              {(["low", "normal", "high", "urgent"] as const).map((priority) => (
                <SelectItem key={priority} value={priority}>
                  {priority}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={requestTypeFilter}
            onValueChange={(value) => {
              setRequestTypeFilter(value as VerificationRequestType | "all");
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Request type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All request types</SelectItem>
              {Array.from(
                new Set((data?.items ?? []).map((request) => request.requestType).filter(Boolean)),
              ).map((requestType) => (
                <SelectItem key={requestType} value={requestType as VerificationRequestType}>
                  {requestType}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={sortBy ?? "created_at"}
            onValueChange={(value) => {
              setSortBy(value as NonNullable<InstitutionVerificationInboxFilters["sortBy"]>);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created_at">Created date</SelectItem>
              <SelectItem value="updated_at">Updated date</SelectItem>
              <SelectItem value="due_date">Due date</SelectItem>
              <SelectItem value="priority">Priority</SelectItem>
              <SelectItem value="status">Status</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={sortOrder}
            onValueChange={(value) => {
              setSortOrder(value as "asc" | "desc");
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Order" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">Newest first</SelectItem>
              <SelectItem value="asc">Oldest first</SelectItem>
            </SelectContent>
          </Select>
          <button
            type="button"
            onClick={() => {
              setAssignedToMe((value) => !value);
              setPage(1);
            }}
            className={`rounded-md border px-3 py-2 text-sm ${
              assignedToMe
                ? "border-[color:var(--kairo-navy)] bg-[color:var(--kairo-teal-soft)] text-[color:var(--kairo-navy-deep)]"
                : "border-border bg-white text-muted-foreground"
            }`}
          >
            Assigned to me
          </button>
        </div>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : isError && isInstitutionError(error) && error.status === 503 ? (
        <ServiceUnavailableState
          title="Verification Requests are unavailable"
          description={getInstitutionErrorMessage(error)}
        />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title={query ? "No matching requests" : "No verification requests"}
          description={
            query
              ? "Try adjusting your search or filters."
              : "Candidate-submitted and organization-routed verification requests will appear here when available."
          }
        />
      ) : (
        <>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {data.total} request{data.total === 1 ? "" : "s"} found
            </span>
            <span>
              Page {data.page} of {Math.max(data.totalPages, 1)}
            </span>
          </div>
          <div className="hidden overflow-hidden rounded-lg border border-border bg-white md:block">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Candidate</th>
                  <th className="px-4 py-2 font-medium">Claim</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Priority</th>
                  <th className="px-4 py-2 font-medium">Received</th>
                  <th className="px-4 py-2 font-medium">Due</th>
                  <th className="px-4 py-2 font-medium">Assigned To</th>
                  <th className="px-4 py-2 font-medium">Next Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map((request) => (
                  <tr key={request.id} className="hover:bg-secondary/40">
                    <td className="px-4 py-3">
                      <Link
                        to="/institution/verifications/$requestId"
                        params={{ requestId: request.id }}
                        className="font-medium text-foreground hover:text-[color:var(--kairo-navy)]"
                      >
                        {request.candidateName}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {request.reference}
                        {request.candidateEmail ? ` · ${request.candidateEmail}` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">
                        {request.claim.degree || request.requestPurpose}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {request.claim.programme && request.claim.programme !== "—"
                          ? `${request.claim.programme} · ${request.claim.graduationYear || "—"}`
                          : request.requestPurpose}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <VerificationStatusBadge status={request.status} />
                    </td>
                    <td className="px-4 py-3">
                      {request.priority ? (
                        <VerificationPriorityBadge priority={request.priority} />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(request.receivedAt)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {request.dueAt ? formatDate(request.dueAt) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {request.assignedTo ?? (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{request.nextAction ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {data.items.map((request) => (
              <Link
                key={request.id}
                to="/institution/verifications/$requestId"
                params={{ requestId: request.id }}
                className="block rounded-lg border border-border bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{request.candidateName}</div>
                    <div className="text-xs text-muted-foreground">{request.reference}</div>
                  </div>
                  <VerificationStatusBadge status={request.status} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-muted-foreground">Claim</div>
                    <div>{request.claim.degree || request.requestPurpose}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Priority</div>
                    <div>{request.priority ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Received</div>
                    <div>{formatDate(request.receivedAt)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Reviewer</div>
                    <div>{request.assignedTo ?? "Unassigned"}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="rounded-md border border-border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              disabled={data.page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              className="rounded-md border border-border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              disabled={data.page >= data.totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function VerificationStatusOption({ status }: { status: VerificationStatus }) {
  return <span className="capitalize">{status.replaceAll("_", " ")}</span>;
}
