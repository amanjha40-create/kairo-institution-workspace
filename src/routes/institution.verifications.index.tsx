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
import { VerificationStatusBadge } from "@/components/institution/StatusBadge";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PermissionDeniedState,
  ServiceUnavailableState,
} from "@/components/institution/PageStates";
import { formatDate } from "@/lib/institution/format";
import type { VerificationStatus } from "@/lib/institution/types";

export const Route = createFileRoute("/institution/verifications/")({
  component: VerificationsPage,
});

const SUMMARY = [
  { key: "pending", label: "Pending" },
  { key: "in_progress", label: "In Progress" },
  { key: "awaiting_clarification", label: "Awaiting Clarification" },
  { key: "completed", label: "Completed" },
] as const;

function VerificationsPage() {
  const { session } = useInstitutionAuth();
  const permissions = getInstitutionPermissions(session);
  const organizationId = session?.institutionId;
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: institutionQueryKeys.verifications(organizationId),
    queryFn: () => {
      if (!organizationId) {
        throw new Error("An active institution context is required.");
      }
      return getInstitutionOrganizationVerificationRequests(organizationId);
    },
    enabled: Boolean(organizationId),
  });
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [reviewerFilter, setReviewerFilter] = useState<string>("all");

  const sourceOptions = useMemo(
    () => Array.from(new Set((data ?? []).map((request) => request.requestedBy))),
    [data],
  );
  const reviewers = useMemo(
    () =>
      Array.from(
        new Set((data ?? []).map((request) => request.assignedTo).filter(Boolean) as string[]),
      ),
    [data],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return (data ?? []).filter((request) => {
      if (statusFilter !== "all" && request.status !== statusFilter) return false;
      if (sourceFilter !== "all" && request.requestedBy !== sourceFilter) return false;
      if (reviewerFilter !== "all" && request.assignedTo !== reviewerFilter) return false;
      if (!needle) return true;

      return [
        request.candidateName,
        request.candidateEmail,
        request.reference,
        request.requestedBy,
        request.requestPurpose,
      ]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(needle));
    });
  }, [data, query, reviewerFilter, sourceFilter, statusFilter]);

  const summaryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    (data ?? []).forEach((request) => {
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
        {SUMMARY.map((item) => (
          <button
            key={item.key}
            onClick={() => setStatusFilter(statusFilter === item.key ? "all" : item.key)}
            className={`rounded-lg border px-4 py-3 text-left transition-colors ${
              statusFilter === item.key
                ? "border-[color:var(--kairo-navy)] bg-white shadow-sm"
                : "border-border bg-white hover:border-[color:var(--kairo-teal)]"
            }`}
          >
            <div className="text-xs font-medium text-muted-foreground">{item.label}</div>
            <div className="mt-1 text-xl font-semibold text-foreground">
              {summaryCounts[item.key] ?? 0}
            </div>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search candidate, email, source, purpose, reference…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Array.from(new Set((data ?? []).map((request) => request.status))).map((status) => (
                <SelectItem key={status} value={status}>
                  <VerificationStatusOption status={status} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              {sourceOptions.map((source) => (
                <SelectItem key={source} value={source}>
                  {source}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={reviewerFilter} onValueChange={setReviewerFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Reviewer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any reviewer</SelectItem>
              {reviewers.map((reviewer) => (
                <SelectItem key={reviewer} value={reviewer}>
                  {reviewer}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
      ) : filtered.length === 0 ? (
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
          <div className="hidden overflow-hidden rounded-lg border border-border bg-white md:block">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Candidate</th>
                  <th className="px-4 py-2 font-medium">Claim</th>
                  <th className="px-4 py-2 font-medium">Source</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Received</th>
                  <th className="px-4 py-2 font-medium">Assigned To</th>
                  <th className="px-4 py-2 font-medium">Next Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((request) => (
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
                    <td className="px-4 py-3">{request.requestedBy}</td>
                    <td className="px-4 py-3">
                      <VerificationStatusBadge status={request.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(request.receivedAt)}
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
            {filtered.map((request) => (
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
                    <div className="text-muted-foreground">Source</div>
                    <div>{request.requestedBy}</div>
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
        </>
      )}
    </div>
  );
}

function VerificationStatusOption({ status }: { status: VerificationStatus }) {
  return <span className="capitalize">{status.replaceAll("_", " ")}</span>;
}
