import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, X, Info, ShieldCheck, FileText } from "lucide-react";
import {
  confirmPublicInstitutionVerification,
  getPublicInstitutionVerificationByToken,
  reportPublicInstitutionVerificationDiscrepancy,
  requestPublicInstitutionVerificationClarification,
} from "@/lib/institution/api";
import { KairoLogo } from "@/components/institution/Logo";
import { Button } from "@/components/ui/button";
import {
  ErrorState,
  LoadingState,
  ServiceUnavailableState,
} from "@/components/institution/PageStates";
import {
  ClarificationDialog,
  ConfirmDialog,
  DiscrepancyDialog,
} from "@/components/institution/ResponseDialogs";
import { formatDate } from "@/lib/institution/format";
import { getInstitutionErrorMessage, isInstitutionError } from "@/lib/institution/errors";
import { institutionQueryKeys } from "@/lib/institution/query-keys";

export const Route = createFileRoute("/institution/verify/$token")({
  head: () => ({
    meta: [
      { title: "Education Verification Request — Kairo" },
      {
        name: "description",
        content: "Respond securely to a one-off education verification request from Kairo.",
      },
      { property: "og:title", content: "Education Verification Request — Kairo" },
      {
        property: "og:description",
        content: "Secure one-off education verification link.",
      },
    ],
  }),
  component: MagicLinkPage,
});

function MagicLinkPage() {
  const { token } = Route.useParams();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: institutionQueryKeys.magicLink(token),
    queryFn: () => getPublicInstitutionVerificationByToken(token),
  });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [discrepancyOpen, setDiscrepancyOpen] = useState(false);
  const [clarifyOpen, setClarifyOpen] = useState(false);
  const [outcome, setOutcome] = useState<null | "confirmed" | "discrepancy" | "clarification">(
    null,
  );
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const respondMutation = useMutation({
    mutationFn: async (
      payload:
        | { type: "confirm"; note?: string }
        | { type: "discrepancy"; fields: string[]; explanation: string }
        | {
            type: "clarification";
            fields: string[];
            message: string;
            requestDocument?: boolean;
          },
    ) => {
      switch (payload.type) {
        case "confirm":
          return confirmPublicInstitutionVerification(token, { note: payload.note });
        case "discrepancy":
          return reportPublicInstitutionVerificationDiscrepancy(token, {
            fields: payload.fields,
            explanation: payload.explanation,
          });
        case "clarification":
          return requestPublicInstitutionVerificationClarification(token, {
            fields: payload.fields,
            message: payload.message,
            requestDocument: payload.requestDocument,
          });
      }
    },
    onSuccess: (nextData, payload) => {
      queryClient.setQueryData(institutionQueryKeys.magicLink(token), nextData);
      setSubmissionError(null);
      setOutcome(
        payload.type === "confirm"
          ? "confirmed"
          : payload.type === "discrepancy"
            ? "discrepancy"
            : "clarification",
      );
    },
    onError: (mutationError) => {
      setSubmissionError(getInstitutionErrorMessage(mutationError));
    },
  });

  if (isError && isInstitutionError(error) && error.status === 503) {
    return <ServiceUnavailableState description={error.uiMessage} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-white to-[color:var(--kairo-teal-soft)]">
      <header className="border-b border-border/60 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <KairoLogo className="h-7 w-auto" />
          <div className="text-xs text-muted-foreground">Secure verification link</div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        {isLoading ? (
          <LoadingState />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : !data ? (
          <ErrorState onRetry={() => refetch()} />
        ) : outcome ? (
          <CompletionPanel outcome={outcome} />
        ) : data.state !== "valid" ? (
          <StateMessage state={data.state} expiresAt={data.expiresAt} />
        ) : (
          <>
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-semibold text-foreground">
                Education Verification Request
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Reference {data.request!.reference} · Expires {formatDate(data.expiresAt)}
              </p>
              <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-[color:var(--kairo-teal-soft)] px-3 py-1 text-xs font-medium text-[color:var(--kairo-navy-deep)]">
                <ShieldCheck className="h-3 w-3" /> This link is unique to your institution and will
                expire once used.
              </p>
            </div>

            <Section title="Requested by">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Cell label="Organization" value={data.request!.requestedBy} />
                <Cell label="Purpose" value={data.request!.purpose} />
                <Cell label="Request date" value={formatDate(data.request!.requestDate)} />
                <Cell
                  label="Candidate consent"
                  value={
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">
                      Consent received
                    </span>
                  }
                />
              </dl>
            </Section>

            <Section title="Candidate-submitted claim">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Cell label="Name" value={data.request!.candidate.candidateName} />
                <Cell label="Student ID" value={data.request!.candidate.studentId ?? "—"} />
                <Cell label="Institution" value={data.request!.candidate.institutionName} />
                <Cell label="Degree" value={data.request!.candidate.degree} />
                <Cell label="Programme" value={data.request!.candidate.programme} />
                <Cell label="Department" value={data.request!.candidate.department} />
                <Cell label="Admission year" value={data.request!.candidate.admissionYear} />
                <Cell label="Graduation year" value={data.request!.candidate.graduationYear} />
                <Cell label="Completion status" value={data.request!.candidate.completionStatus} />
              </dl>
            </Section>

            {data.request!.evidence.length > 0 && (
              <Section title="Shared evidence">
                <ul className="divide-y divide-border">
                  {data.request!.evidence.map((f) => (
                    <li key={f.id} className="flex items-center justify-between py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{f.name}</div>
                          <div className="text-xs text-muted-foreground">{f.type}</div>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" disabled>
                        View
                      </Button>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setClarifyOpen(true)}
                disabled={respondMutation.isPending}
              >
                <Info className="mr-1 h-4 w-4" /> Request Clarification
              </Button>
              <Button
                variant="outline"
                onClick={() => setDiscrepancyOpen(true)}
                disabled={respondMutation.isPending}
              >
                <X className="mr-1 h-4 w-4" /> Report Discrepancy
              </Button>
              <Button onClick={() => setConfirmOpen(true)} disabled={respondMutation.isPending}>
                <Check className="mr-1 h-4 w-4" /> Confirm
              </Button>
            </div>

            {submissionError && (
              <div
                role="alert"
                className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
              >
                {submissionError}
              </div>
            )}

            <ConfirmDialog
              open={confirmOpen}
              claim={data.request!.candidate}
              submitting={respondMutation.isPending}
              onOpenChange={setConfirmOpen}
              onSubmit={async (note) => {
                await respondMutation.mutateAsync({ type: "confirm", note });
                setConfirmOpen(false);
              }}
            />
            <DiscrepancyDialog
              open={discrepancyOpen}
              submitting={respondMutation.isPending}
              onOpenChange={setDiscrepancyOpen}
              onSubmit={async (fields, explanation) => {
                await respondMutation.mutateAsync({
                  type: "discrepancy",
                  fields,
                  explanation,
                });
                setDiscrepancyOpen(false);
              }}
            />
            <ClarificationDialog
              open={clarifyOpen}
              submitting={respondMutation.isPending}
              onOpenChange={setClarifyOpen}
              onSubmit={async (fields, message, requestDocument) => {
                await respondMutation.mutateAsync({
                  type: "clarification",
                  fields,
                  message,
                  requestDocument,
                });
                setClarifyOpen(false);
              }}
            />
          </>
        )}
      </main>
    </div>
  );
}

function CompletionPanel({ outcome }: { outcome: "confirmed" | "discrepancy" | "clarification" }) {
  const labels = {
    confirmed: "Verification response submitted",
    discrepancy: "Discrepancy reported",
    clarification: "Clarification request sent",
  };
  return (
    <div className="rounded-2xl border border-border bg-white p-8 text-center shadow-sm">
      <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-[color:var(--kairo-teal-soft)]">
        <Check className="h-5 w-5 text-[color:var(--kairo-navy-deep)]" />
      </div>
      <h2 className="text-lg font-semibold">{labels[outcome]}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Thank you. Your response has been securely recorded and shared with the authorized parties.
      </p>
      <div className="mt-5 flex justify-center gap-2">
        <Button onClick={() => window.close()}>Finish</Button>
        <Button asChild variant="outline">
          <a href="/institution?source=verification-complete">See how Kairo helps institutions</a>
        </Button>
      </div>
    </div>
  );
}

function StateMessage({
  state,
  expiresAt,
}: {
  state: "expired" | "completed" | "revoked" | "invalid" | "valid";
  expiresAt?: string;
}) {
  const map = {
    expired: {
      title: "This link has expired",
      body: `The verification link expired on ${formatDate(expiresAt)}. Please contact the requesting organization for a new link.`,
    },
    completed: {
      title: "This request has already been completed",
      body: "A response has already been submitted for this verification request.",
    },
    revoked: {
      title: "This link has been revoked",
      body: "The requester has revoked this verification link. Please contact them if you have questions.",
    },
    invalid: {
      title: "Invalid verification link",
      body: "We could not find a verification request for this link. Please check the URL or contact the requester.",
    },
    valid: { title: "", body: "" },
  }[state];
  return (
    <div className="rounded-2xl border border-border bg-white p-8 text-center shadow-sm">
      <h2 className="text-lg font-semibold">{map.title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{map.body}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 rounded-2xl border border-border bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Cell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm text-foreground">{value}</div>
    </div>
  );
}
