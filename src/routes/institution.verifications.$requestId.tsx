import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, Check, FileText, Info, X } from "lucide-react";
import {
  addInternalNote,
  assignInstitutionVerificationRequestReviewer,
  getInstitutionTeam,
  getInstitutionVerificationEvidenceItems,
  getInstitutionVerificationRequest,
  getInstitutionVerificationTimelineItems,
  requestInstitutionClarification,
  respondToInstitutionVerification,
} from "@/lib/institution/api";
import { useInstitutionAuth } from "@/lib/institution/auth";
import { getInstitutionErrorMessage, isInstitutionError } from "@/lib/institution/errors";
import { formatDate, formatDateTime } from "@/lib/institution/format";
import { getInstitutionPermissions } from "@/lib/institution/permissions";
import { institutionQueryKeys } from "@/lib/institution/query-keys";
import { getVerificationRequestTypeLabel } from "@/lib/institution/verification";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PermissionDeniedState,
  ServiceUnavailableState,
} from "@/components/institution/PageStates";
import {
  ClarificationDialog,
  ConfirmDialog,
  DiscrepancyDialog,
} from "@/components/institution/ResponseDialogs";
import { VerificationStatusBadge } from "@/components/institution/StatusBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/institution/verifications/$requestId")({
  component: RequestDetailPage,
});

const terminalStatuses = new Set([
  "verified",
  "rejected",
  "cancelled",
  "expired",
  "confirmed",
  "discrepancy",
  "closed",
]);

function RequestDetailPage() {
  const { requestId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { session } = useInstitutionAuth();
  const permissions = getInstitutionPermissions(session);
  const organizationId = session?.institutionId;
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: institutionQueryKeys.verification(requestId),
    queryFn: () => getInstitutionVerificationRequest(requestId),
  });
  const evidenceQuery = useQuery({
    queryKey: institutionQueryKeys.verificationEvidence(requestId),
    queryFn: () => getInstitutionVerificationEvidenceItems(requestId),
    enabled: Boolean(data),
  });
  const timelineQuery = useQuery({
    queryKey: institutionQueryKeys.verificationTimeline(requestId),
    queryFn: () => getInstitutionVerificationTimelineItems(requestId),
    enabled: Boolean(data),
  });
  const teamQuery = useQuery({
    queryKey: institutionQueryKeys.team(organizationId),
    queryFn: () => {
      if (!organizationId) {
        throw new Error("An active institution context is required.");
      }
      return getInstitutionTeam(organizationId);
    },
    enabled: Boolean(organizationId) && permissions.canManageTeam,
  });

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [discrepancyOpen, setDiscrepancyOpen] = useState(false);
  const [clarifyOpen, setClarifyOpen] = useState(false);
  const [note, setNote] = useState("");
  const [selectedReviewerId, setSelectedReviewerId] = useState("unassigned");
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const request = data;
  const currentInternalNote =
    request?.organizationInternalNote ?? request?.internalNotes[0]?.body ?? "";
  const evidence = evidenceQuery.data ?? request?.evidence ?? [];
  const timeline = timelineQuery.data ?? request?.timeline ?? [];
  const assignableMembers = useMemo(
    () =>
      (teamQuery.data?.members ?? []).filter(
        (member) => member.status === "active" && member.role !== "member",
      ),
    [teamQuery.data],
  );

  useEffect(() => {
    setNote(currentInternalNote);
  }, [currentInternalNote]);

  useEffect(() => {
    if (!request) return;

    const matchedMember = assignableMembers.find(
      (member) => member.email.toLowerCase() === request.assignedReviewer?.email?.toLowerCase(),
    );
    setSelectedReviewerId(matchedMember?.id ?? "unassigned");
  }, [assignableMembers, request]);

  const invalidate = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: institutionQueryKeys.verification(requestId) }),
      qc.invalidateQueries({ queryKey: institutionQueryKeys.verificationEvidence(requestId) }),
      qc.invalidateQueries({ queryKey: institutionQueryKeys.verificationTimeline(requestId) }),
      qc.invalidateQueries({ queryKey: institutionQueryKeys.verifications(organizationId) }),
    ]);
  };

  if (!permissions.canViewVerificationRequests) {
    return <PermissionDeniedState />;
  }

  if (isLoading) return <LoadingState />;
  if (isError && isInstitutionError(error) && error.status === 403) {
    return <PermissionDeniedState />;
  }
  if (isError && isInstitutionError(error) && error.status === 404) {
    return (
      <EmptyState
        title="Request not found"
        description="This verification request may have been closed or the link is invalid."
        action={
          <Button variant="outline" onClick={() => navigate({ to: "/institution/verifications" })}>
            Back to Verification Requests
          </Button>
        }
      />
    );
  }
  if (isError && isInstitutionError(error) && error.status === 503) {
    return (
      <ServiceUnavailableState
        title="Verification request unavailable"
        description={error.uiMessage}
      />
    );
  }
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (!request) return null;

  const canRespond =
    permissions.canRespondToVerificationRequests && !terminalStatuses.has(request.status);
  const rowClass = "grid grid-cols-2 gap-3 text-sm";

  return (
    <div className="space-y-6">
      <Link
        to="/institution/verifications"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Verification Requests
      </Link>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-white p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-xl font-semibold text-foreground">
              {request.candidateName}
            </h1>
            <VerificationStatusBadge status={request.status} />
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>Ref: {request.reference}</span>
            <span>Received: {formatDate(request.receivedAt)}</span>
            {request.dueAt && <span>Due: {formatDate(request.dueAt)}</span>}
            <span>Reviewer: {request.assignedTo ?? "Unassigned"}</span>
          </div>
        </div>
        {canRespond && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setConfirmOpen(true)}>
              <Check className="mr-1 h-4 w-4" /> Verify
            </Button>
            <Button size="sm" variant="outline" onClick={() => setDiscrepancyOpen(true)}>
              <X className="mr-1 h-4 w-4" /> Reject
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setClarifyOpen(true)}>
              <Info className="mr-1 h-4 w-4" /> Request Clarification
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Request information" className="lg:col-span-1">
          <dl className="space-y-2 text-sm">
            <FieldRow label="Source" value={request.requestedBy} />
            <FieldRow label="Request purpose" value={request.requestPurpose} />
            <FieldRow
              label="Request type"
              value={getVerificationRequestTypeLabel(request.requestType)}
            />
            <FieldRow label="Request date" value={formatDate(request.receivedAt)} />
            {request.dueAt && <FieldRow label="Due date" value={formatDate(request.dueAt)} />}
            {request.candidateEmail && (
              <FieldRow label="Candidate email" value={request.candidateEmail} />
            )}
            <div className="pt-1">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">
                {request.consentReceived
                  ? "Candidate consent received"
                  : "Awaiting candidate consent"}
              </span>
            </div>
          </dl>
        </Section>

        <Section title="Candidate-submitted claim" className="lg:col-span-1">
          <dl className={rowClass}>
            <FieldCell label="Candidate name" value={request.claim.candidateName} />
            <FieldCell label="Student ID" value={request.claim.studentId ?? "—"} />
            <FieldCell label="Institution" value={request.claim.institutionName || "—"} />
            <FieldCell label="Degree" value={request.claim.degree || "—"} />
            <FieldCell label="Programme" value={request.claim.programme || "—"} />
            <FieldCell label="Department" value={request.claim.department || "—"} />
            <FieldCell label="Admission year" value={request.claim.admissionYear || "—"} />
            <FieldCell label="Graduation year" value={request.claim.graduationYear || "—"} />
            <FieldCell label="Completion status" value={request.claim.completionStatus || "—"} />
            <FieldCell
              label="Consented fields"
              value={
                request.consentedFields && request.consentedFields.length > 0
                  ? request.consentedFields.join(", ")
                  : "—"
              }
            />
          </dl>
          {request.claim.additionalNote && (
            <p className="mt-3 rounded-md border border-border bg-secondary/50 p-2 text-xs text-muted-foreground">
              {request.claim.additionalNote}
            </p>
          )}
        </Section>

        <Section title="Institution record" className="lg:col-span-1">
          {request.source === "backend" ? (
            <div className="rounded-md border border-dashed border-border bg-secondary/40 p-4 text-sm">
              <div className="font-medium">Institution record comparison unavailable</div>
              <p className="mt-1 text-xs text-muted-foreground">
                The shared verification-request backend does not yet return institution-record
                comparison data for this request. Final verification actions remain available below.
              </p>
            </div>
          ) : request.institutionRecord.found ? (
            <>
              <div className="mb-3 flex items-center gap-2 text-xs">
                <span className="rounded-full bg-[color:var(--kairo-teal-soft)] px-2 py-0.5 font-medium text-[color:var(--kairo-navy-deep)]">
                  {request.matchStatus === "exact"
                    ? "Exact Match"
                    : request.matchStatus === "partial"
                      ? "Partial Match"
                      : request.matchStatus === "no_match"
                        ? "No Match"
                        : "Record Unavailable"}
                </span>
                <span className="text-muted-foreground">Record found in institution data</span>
              </div>
              <dl className={rowClass}>
                <FieldCell
                  label="Student ID"
                  value={request.institutionRecord.studentId ?? "—"}
                  diff={request.fieldMatches?.["Student ID"] === "different"}
                />
                <FieldCell
                  label="Official name"
                  value={request.institutionRecord.officialName ?? "—"}
                />
                <FieldCell
                  label="Degree"
                  value={request.institutionRecord.degree ?? "—"}
                  diff={request.fieldMatches?.Degree === "different"}
                />
                <FieldCell
                  label="Programme"
                  value={request.institutionRecord.programme ?? "—"}
                  diff={request.fieldMatches?.Programme === "different"}
                />
                <FieldCell label="Department" value={request.institutionRecord.department ?? "—"} />
                <FieldCell
                  label="Admission"
                  value={formatDate(request.institutionRecord.admissionDate)}
                />
                <FieldCell
                  label="Graduation"
                  value={formatDate(request.institutionRecord.graduationDate)}
                  diff={request.fieldMatches?.["Graduation year"] === "different"}
                />
                <FieldCell
                  label="Completion"
                  value={request.institutionRecord.completionStatus ?? "—"}
                  diff={request.fieldMatches?.["Completion status"] === "different"}
                />
                <FieldCell
                  label="Credential issuance"
                  value={request.institutionRecord.credentialIssuanceStatus ?? "—"}
                />
              </dl>
            </>
          ) : (
            <div className="rounded-md border border-dashed border-border bg-secondary/40 p-4 text-sm">
              <div className="font-medium">No connected institution record</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Compare the candidate-submitted claim with your internal records and respond with
                the appropriate action.
              </p>
            </div>
          )}
        </Section>
      </div>

      <Section title="Shared evidence">
        {evidenceQuery.isLoading ? (
          <LoadingState />
        ) : evidenceQuery.isError ? (
          <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            Evidence could not be loaded right now.
          </div>
        ) : evidence.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            No evidence has been shared for this request yet.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {evidence.map((file) => (
              <li key={file.id} className="flex items-center justify-between py-2 text-sm">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{file.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {file.type} · Uploaded by {file.uploadedBy} · {formatDate(file.uploadedAt)}
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (!file.url) {
                      toast.error("This evidence item is not available for download.");
                      return;
                    }

                    window.open(file.url, "_blank", "noopener,noreferrer");
                  }}
                >
                  View
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Internal review">
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">
            Assigned reviewer:{" "}
            <span className="text-foreground">{request.assignedTo ?? "Unassigned"}</span>
          </div>

          {permissions.canManageTeam && teamQuery.data ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">Assign reviewer</label>
                <Select value={selectedReviewerId} onValueChange={setSelectedReviewerId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {assignableMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name} · {member.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                disabled={pendingAction === "assign-reviewer"}
                onClick={async () => {
                  try {
                    setPendingAction("assign-reviewer");
                    await assignInstitutionVerificationRequestReviewer(
                      request.id,
                      selectedReviewerId === "unassigned" ? undefined : selectedReviewerId,
                    );
                    await invalidate();
                    toast.success("Reviewer assignment updated");
                  } catch (err) {
                    toast.error(getInstitutionErrorMessage(err));
                  } finally {
                    setPendingAction(null);
                  }
                }}
              >
                {pendingAction === "assign-reviewer" ? "Saving…" : "Save assignment"}
              </Button>
            </div>
          ) : null}

          <div className="space-y-2">
            {!currentInternalNote && (
              <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                No internal note saved yet. Notes remain private to your institution workspace.
              </div>
            )}
            <Textarea
              placeholder="Save an internal note (not visible to the candidate or requester)"
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                disabled={
                  pendingAction === "save-note" || note.trim() === currentInternalNote.trim()
                }
                onClick={async () => {
                  try {
                    setPendingAction("save-note");
                    await addInternalNote(
                      request.id,
                      session?.name ?? "Institution team",
                      note.trim(),
                    );
                    await invalidate();
                    toast.success("Internal note saved");
                  } catch (err) {
                    toast.error(getInstitutionErrorMessage(err));
                  } finally {
                    setPendingAction(null);
                  }
                }}
              >
                {pendingAction === "save-note" ? "Saving…" : "Save note"}
              </Button>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Activity timeline">
        {timelineQuery.isLoading ? (
          <LoadingState />
        ) : timelineQuery.isError ? (
          <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            Activity could not be loaded right now.
          </div>
        ) : timeline.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            No activity has been recorded for this request yet.
          </div>
        ) : (
          <ol className="space-y-3">
            {timeline.map((item) => (
              <li key={item.id} className="flex gap-3 text-sm">
                <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[color:var(--kairo-teal)]" />
                <div className="min-w-0">
                  <div className="font-medium">{item.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDateTime(item.at)}
                    {item.detail ? ` · ${item.detail}` : ""}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <ConfirmDialog
        open={confirmOpen}
        claim={request.claim}
        submitting={pendingAction === "verify"}
        onOpenChange={setConfirmOpen}
        onSubmit={async (dialogNote) => {
          try {
            setPendingAction("verify");
            await respondToInstitutionVerification(request.id, "confirm", { note: dialogNote });
            setConfirmOpen(false);
            await invalidate();
            toast.success("Verification completed");
          } catch (err) {
            toast.error(getInstitutionErrorMessage(err));
          } finally {
            setPendingAction(null);
          }
        }}
      />
      <DiscrepancyDialog
        open={discrepancyOpen}
        submitting={pendingAction === "reject"}
        onOpenChange={setDiscrepancyOpen}
        onSubmit={async (fields, explanation) => {
          try {
            setPendingAction("reject");
            await respondToInstitutionVerification(request.id, "discrepancy", {
              fields,
              reason: explanation,
            });
            setDiscrepancyOpen(false);
            await invalidate();
            toast.success("Request rejected");
          } catch (err) {
            toast.error(getInstitutionErrorMessage(err));
          } finally {
            setPendingAction(null);
          }
        }}
      />
      <ClarificationDialog
        open={clarifyOpen}
        submitting={pendingAction === "clarification"}
        onOpenChange={setClarifyOpen}
        onSubmit={async (fields, message, requestDocument) => {
          try {
            setPendingAction("clarification");
            await requestInstitutionClarification(request.id, {
              fields,
              message,
              requestDocument,
            });
            setClarifyOpen(false);
            await invalidate();
            toast.success("Clarification requested");
          } catch (err) {
            toast.error(getInstitutionErrorMessage(err));
          } finally {
            setPendingAction(null);
          }
        }}
      />
    </div>
  );
}

function Section({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-border bg-white p-5 shadow-sm ${className}`}>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function FieldRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );
}

function FieldCell({
  label,
  value,
  diff = false,
}: {
  label: string;
  value: ReactNode;
  diff?: boolean;
}) {
  return (
    <div className={diff ? "rounded-md bg-rose-50 p-2 -m-2 ring-1 ring-inset ring-rose-200" : ""}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-sm ${diff ? "font-medium text-rose-900" : "text-foreground"}`}>
        {value}
      </div>
    </div>
  );
}
