import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, FileText, Check, X, Info } from "lucide-react";
import {
  addInternalNote,
  getInstitutionVerificationRequest,
  requestInstitutionClarification,
  respondToInstitutionVerification,
} from "@/lib/institution/api";
import { useInstitutionAuth } from "@/lib/institution/auth";
import { getInstitutionErrorMessage, isInstitutionError } from "@/lib/institution/errors";
import { getInstitutionPermissions } from "@/lib/institution/permissions";
import { institutionQueryKeys } from "@/lib/institution/query-keys";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VerificationStatusBadge } from "@/components/institution/StatusBadge";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  ServiceUnavailableState,
} from "@/components/institution/PageStates";
import { formatDate, formatDateTime } from "@/lib/institution/format";
import {
  ConfirmDialog,
  DiscrepancyDialog,
  ClarificationDialog,
} from "@/components/institution/ResponseDialogs";
import { toast } from "sonner";

export const Route = createFileRoute("/institution/verifications/$requestId")({
  component: RequestDetailPage,
});

function RequestDetailPage() {
  const { requestId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { session } = useInstitutionAuth();
  const permissions = getInstitutionPermissions(session);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: institutionQueryKeys.verification(requestId),
    queryFn: () => getInstitutionVerificationRequest(requestId),
  });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [discrepancyOpen, setDiscrepancyOpen] = useState(false);
  const [clarifyOpen, setClarifyOpen] = useState(false);
  const [note, setNote] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: institutionQueryKeys.verification(requestId) });
    qc.invalidateQueries({ queryKey: institutionQueryKeys.verifications() });
  };

  if (isLoading) return <LoadingState />;
  if (isError && isInstitutionError(error) && error.status === 503) {
    return (
      <ServiceUnavailableState
        title="Verification request unavailable"
        description={error.uiMessage}
      />
    );
  }
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (!data)
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

  const r = data;
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
            <h1 className="truncate text-xl font-semibold text-foreground">{r.candidateName}</h1>
            <VerificationStatusBadge status={r.status} />
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>Ref: {r.reference}</span>
            <span>Received: {formatDate(r.receivedAt)}</span>
            {r.dueAt && <span>Due: {formatDate(r.dueAt)}</span>}
            <span>Reviewer: {r.assignedTo ?? "Unassigned"}</span>
          </div>
        </div>
        {permissions.canRespondToVerificationRequests &&
          r.status !== "confirmed" &&
          r.status !== "discrepancy" &&
          r.status !== "closed" && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setConfirmOpen(true)}>
                <Check className="mr-1 h-4 w-4" /> Confirm
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDiscrepancyOpen(true)}>
                <X className="mr-1 h-4 w-4" /> Report Discrepancy
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
            <FieldRow label="Requesting organization" value={r.requestedBy} />
            <FieldRow label="Request purpose" value={r.requestPurpose} />
            <FieldRow label="Request date" value={formatDate(r.receivedAt)} />
            {r.requestingContact && <FieldRow label="Contact" value={r.requestingContact} />}
            <div className="pt-1">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">
                {r.consentReceived ? "Candidate consent received" : "Awaiting candidate consent"}
              </span>
            </div>
          </dl>
        </Section>

        <Section title="Candidate-submitted claim" className="lg:col-span-1">
          <dl className={rowClass}>
            <FieldCell label="Candidate name" value={r.claim.candidateName} />
            <FieldCell label="Student ID" value={r.claim.studentId ?? "—"} />
            <FieldCell label="Institution" value={r.claim.institutionName} />
            <FieldCell label="Degree" value={r.claim.degree} />
            <FieldCell label="Programme" value={r.claim.programme} />
            <FieldCell label="Department" value={r.claim.department} />
            <FieldCell label="Admission year" value={r.claim.admissionYear} />
            <FieldCell label="Graduation year" value={r.claim.graduationYear} />
            <FieldCell label="Completion status" value={r.claim.completionStatus} />
          </dl>
          {r.claim.additionalNote && (
            <p className="mt-3 rounded-md border border-border bg-secondary/50 p-2 text-xs text-muted-foreground">
              {r.claim.additionalNote}
            </p>
          )}
        </Section>

        <Section title="Institution record" className="lg:col-span-1">
          {r.institutionRecord.found ? (
            <>
              <div className="mb-3 flex items-center gap-2 text-xs">
                <span className="rounded-full bg-[color:var(--kairo-teal-soft)] px-2 py-0.5 font-medium text-[color:var(--kairo-navy-deep)]">
                  {r.matchStatus === "exact"
                    ? "Exact Match"
                    : r.matchStatus === "partial"
                      ? "Partial Match"
                      : r.matchStatus === "no_match"
                        ? "No Match"
                        : "Record Unavailable"}
                </span>
                <span className="text-muted-foreground">Record found in institution data</span>
              </div>
              <dl className={rowClass}>
                <FieldCell
                  label="Student ID"
                  value={r.institutionRecord.studentId ?? "—"}
                  diff={r.fieldMatches?.["Student ID"] === "different"}
                />
                <FieldCell label="Official name" value={r.institutionRecord.officialName ?? "—"} />
                <FieldCell
                  label="Degree"
                  value={r.institutionRecord.degree ?? "—"}
                  diff={r.fieldMatches?.["Degree"] === "different"}
                />
                <FieldCell
                  label="Programme"
                  value={r.institutionRecord.programme ?? "—"}
                  diff={r.fieldMatches?.["Programme"] === "different"}
                />
                <FieldCell label="Department" value={r.institutionRecord.department ?? "—"} />
                <FieldCell
                  label="Admission"
                  value={formatDate(r.institutionRecord.admissionDate)}
                />
                <FieldCell
                  label="Graduation"
                  value={formatDate(r.institutionRecord.graduationDate)}
                  diff={r.fieldMatches?.["Graduation year"] === "different"}
                />
                <FieldCell
                  label="Completion"
                  value={r.institutionRecord.completionStatus ?? "—"}
                  diff={r.fieldMatches?.["Completion status"] === "different"}
                />
                <FieldCell
                  label="Credential issuance"
                  value={r.institutionRecord.credentialIssuanceStatus ?? "—"}
                />
              </dl>
              <p className="mt-3 text-xs text-muted-foreground">
                This record was retrieved from the institution's connected data source. The
                institution remains responsible for the final response.
              </p>
            </>
          ) : (
            <div className="rounded-md border border-dashed border-border bg-secondary/40 p-4 text-sm">
              <div className="font-medium">No connected institution record</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Please compare the candidate-submitted claim above with your internal records and
                respond with the appropriate action.
              </p>
            </div>
          )}
        </Section>
      </div>

      {r.evidence.length > 0 && (
        <Section title="Shared evidence">
          <ul className="divide-y divide-border">
            {r.evidence.map((f) => (
              <li key={f.id} className="flex items-center justify-between py-2 text-sm">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{f.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {f.type} · Uploaded by {f.uploadedBy} · {formatDate(f.uploadedAt)}
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => toast("Preview not available in mock data")}
                >
                  View
                </Button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Internal review">
        <div className="mb-3 text-xs text-muted-foreground">
          Assigned reviewer: <span className="text-foreground">{r.assignedTo ?? "Unassigned"}</span>
        </div>
        <div className="space-y-2">
          {r.internalNotes.length === 0 && (
            <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
              No internal notes yet. Notes are only visible to your team.
            </div>
          )}
          {r.internalNotes.map((n) => (
            <div key={n.id} className="rounded-md border border-border bg-secondary/40 p-3 text-sm">
              <div className="text-xs text-muted-foreground">
                {n.author} · {formatDateTime(n.createdAt)}
              </div>
              <div className="mt-1">{n.body}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 space-y-2">
          <Textarea
            placeholder="Add an internal note (not visible to candidate or requester)"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              disabled={!note.trim()}
              onClick={async () => {
                try {
                  await addInternalNote(r.id, session?.name ?? "You", note.trim());
                  setNote("");
                  invalidate();
                  toast.success("Note added");
                } catch (err) {
                  toast.error(getInstitutionErrorMessage(err));
                }
              }}
            >
              Add note
            </Button>
          </div>
        </div>
      </Section>

      <Section title="Activity timeline">
        <ol className="space-y-3">
          {r.timeline.map((t) => (
            <li key={t.id} className="flex gap-3 text-sm">
              <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[color:var(--kairo-teal)]" />
              <div className="min-w-0">
                <div className="font-medium">{t.label}</div>
                <div className="text-xs text-muted-foreground">
                  {formatDateTime(t.at)}
                  {t.detail ? ` · ${t.detail}` : ""}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <ConfirmDialog
        open={confirmOpen}
        claim={r.claim}
        onOpenChange={setConfirmOpen}
        onSubmit={async (n) => {
          try {
            await respondToInstitutionVerification(r.id, "confirm", { note: n });
            setConfirmOpen(false);
            invalidate();
            toast.success("Verification confirmed");
          } catch (err) {
            toast.error(getInstitutionErrorMessage(err));
          }
        }}
      />
      <DiscrepancyDialog
        open={discrepancyOpen}
        onOpenChange={setDiscrepancyOpen}
        onSubmit={async (fields, explanation) => {
          try {
            await respondToInstitutionVerification(r.id, "discrepancy", {
              fields,
              reason: explanation,
            });
            setDiscrepancyOpen(false);
            invalidate();
            toast.success("Discrepancy reported");
          } catch (err) {
            toast.error(getInstitutionErrorMessage(err));
          }
        }}
      />
      <ClarificationDialog
        open={clarifyOpen}
        onOpenChange={setClarifyOpen}
        onSubmit={async (fields, message, requestDocument) => {
          try {
            await requestInstitutionClarification(r.id, { fields, message, requestDocument });
            setClarifyOpen(false);
            invalidate();
            toast.success("Clarification requested");
          } catch (err) {
            toast.error(getInstitutionErrorMessage(err));
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
  children: React.ReactNode;
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

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
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
  value: React.ReactNode;
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
