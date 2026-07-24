import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { getInstitutionVerificationRequests } from "@/lib/institution/api";
import { isInstitutionError } from "@/lib/institution/errors";
import { institutionQueryKeys } from "@/lib/institution/query-keys";
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
  ServiceUnavailableState,
} from "@/components/institution/PageStates";
import { formatDate } from "@/lib/institution/format";
import type { VerificationStatus } from "@/lib/institution/types";

export const Route = createFileRoute("/institution/verifications/")({
  component: VerificationsPage,
});

const SUMMARY: { key: VerificationStatus; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "in_progress", label: "In Progress" },
  { key: "awaiting_clarification", label: "Awaiting Clarification" },
  { key: "confirmed", label: "Completed" },
];

function VerificationsPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: institutionQueryKeys.verifications(),
    queryFn: getInstitutionVerificationRequests,
  });
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [orgFilter, setOrgFilter] = useState<string>("all");
  const [reviewerFilter, setReviewerFilter] = useState<string>("all");

  const orgs = useMemo(() => Array.from(new Set((data ?? []).map((r) => r.requestedBy))), [data]);
  const reviewers = useMemo(
    () => Array.from(new Set((data ?? []).map((r) => r.assignedTo).filter(Boolean) as string[])),
    [data],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? []).filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (orgFilter !== "all" && r.requestedBy !== orgFilter) return false;
      if (reviewerFilter !== "all" && r.assignedTo !== reviewerFilter) return false;
      if (!q) return true;
      return (
        r.candidateName.toLowerCase().includes(q) ||
        r.reference.toLowerCase().includes(q) ||
        (r.claim.studentId ?? "").toLowerCase().includes(q) ||
        r.requestedBy.toLowerCase().includes(q)
      );
    });
  }, [data, query, statusFilter, orgFilter, reviewerFilter]);

  const summaryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    (data ?? []).forEach((r) => {
      counts[r.status] = (counts[r.status] ?? 0) + 1;
    });
    return counts;
  }, [data]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Verification Requests
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review and respond to education verification requests.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SUMMARY.map((s) => (
          <button
            key={s.key}
            onClick={() => setStatusFilter(statusFilter === s.key ? "all" : s.key)}
            className={`rounded-lg border px-4 py-3 text-left transition-colors ${
              statusFilter === s.key
                ? "border-[color:var(--kairo-navy)] bg-white shadow-sm"
                : "border-border bg-white hover:border-[color:var(--kairo-teal)]"
            }`}
          >
            <div className="text-xs font-medium text-muted-foreground">{s.label}</div>
            <div className="mt-1 text-xl font-semibold text-foreground">
              {summaryCounts[s.key] ?? 0}
            </div>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search candidate, student ID, organization, reference…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending Review</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="awaiting_clarification">Awaiting Clarification</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="discrepancy">Discrepancy Reported</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={orgFilter} onValueChange={setOrgFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Organization" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All organizations</SelectItem>
              {orgs.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={reviewerFilter} onValueChange={setReviewerFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Reviewer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any reviewer</SelectItem>
              {reviewers.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
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
          description={error.uiMessage}
        />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={query ? "No matching requests" : "No verification requests"}
          description={
            query
              ? "Try adjusting your search or filters."
              : "New requests from employers and partners will appear here."
          }
        />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-lg border border-border bg-white md:block">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Candidate</th>
                  <th className="px-4 py-2 font-medium">Education Claim</th>
                  <th className="px-4 py-2 font-medium">Requested By</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Received</th>
                  <th className="px-4 py-2 font-medium">Assigned To</th>
                  <th className="px-4 py-2 font-medium">Next Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-secondary/40">
                    <td className="px-4 py-3">
                      <Link
                        to="/institution/verifications/$requestId"
                        params={{ requestId: r.id }}
                        className="font-medium text-foreground hover:text-[color:var(--kairo-navy)]"
                      >
                        {r.candidateName}
                      </Link>
                      <div className="text-xs text-muted-foreground">{r.reference}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">{r.claim.degree}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.claim.programme} · {r.claim.graduationYear}
                      </div>
                    </td>
                    <td className="px-4 py-3">{r.requestedBy}</td>
                    <td className="px-4 py-3">
                      <VerificationStatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(r.receivedAt)}</td>
                    <td className="px-4 py-3">
                      {r.assignedTo ?? <span className="text-muted-foreground">Unassigned</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.nextAction ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {filtered.map((r) => (
              <Link
                key={r.id}
                to="/institution/verifications/$requestId"
                params={{ requestId: r.id }}
                className="block rounded-lg border border-border bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{r.candidateName}</div>
                    <div className="text-xs text-muted-foreground">{r.reference}</div>
                  </div>
                  <VerificationStatusBadge status={r.status} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-muted-foreground">Claim</div>
                    <div>{r.claim.degree}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Requested by</div>
                    <div>{r.requestedBy}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Received</div>
                    <div>{formatDate(r.receivedAt)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Reviewer</div>
                    <div>{r.assignedTo ?? "Unassigned"}</div>
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
