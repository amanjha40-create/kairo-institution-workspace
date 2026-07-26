import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import {
  getInstitutionPerson,
  getInstitutionPersonCredentials,
  getInstitutionPersonVerificationHistory,
} from "@/lib/institution/api";
import { useInstitutionAuth } from "@/lib/institution/auth";
import { getInstitutionErrorMessage, isInstitutionError } from "@/lib/institution/errors";
import { formatDate, formatDateTime } from "@/lib/institution/format";
import { mapCredentialStatusLabel } from "@/lib/institution/people";
import { getInstitutionPermissions } from "@/lib/institution/permissions";
import { institutionQueryKeys } from "@/lib/institution/query-keys";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PermissionDeniedState,
  ServiceUnavailableState,
} from "@/components/institution/PageStates";
import {
  InstitutionStatusBadge,
  PassportStatusBadge,
  TrustStatusBadge,
} from "@/components/institution/StatusBadge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/institution/people/$personId")({
  component: PersonDetailPage,
});

function PersonDetailPage() {
  const { personId } = Route.useParams();
  const navigate = useNavigate();
  const { session } = useInstitutionAuth();
  const permissions = getInstitutionPermissions(session);
  const organizationId = session?.institutionId;

  const detailQuery = useQuery({
    queryKey: institutionQueryKeys.person(organizationId, personId),
    queryFn: () => {
      if (!organizationId) {
        throw new Error("An active institution context is required.");
      }

      return getInstitutionPerson(organizationId, personId);
    },
    enabled: Boolean(organizationId) && permissions.canViewPeople,
  });

  const verificationHistoryQuery = useQuery({
    queryKey: institutionQueryKeys.personVerificationHistory(organizationId, personId),
    queryFn: () => {
      if (!organizationId) {
        throw new Error("An active institution context is required.");
      }

      return getInstitutionPersonVerificationHistory(organizationId, personId);
    },
    enabled: Boolean(organizationId) && permissions.canViewPeople && Boolean(detailQuery.data),
  });

  const credentialsQuery = useQuery({
    queryKey: institutionQueryKeys.personCredentials(organizationId, personId),
    queryFn: () => {
      if (!organizationId) {
        throw new Error("An active institution context is required.");
      }

      return getInstitutionPersonCredentials(organizationId, personId);
    },
    enabled: Boolean(organizationId) && permissions.canViewPeople && Boolean(detailQuery.data),
  });

  if (!permissions.canViewPeople) {
    return <PermissionDeniedState />;
  }

  if (detailQuery.isLoading) return <LoadingState />;

  if (
    detailQuery.isError &&
    isInstitutionError(detailQuery.error) &&
    detailQuery.error.status === 403
  ) {
    return <PermissionDeniedState />;
  }

  if (
    detailQuery.isError &&
    isInstitutionError(detailQuery.error) &&
    detailQuery.error.status === 404
  ) {
    return (
      <EmptyState
        title="Person not found"
        description="This person may no longer be linked to your institution."
        action={
          <Button variant="outline" onClick={() => navigate({ to: "/institution/people" })}>
            Back to People
          </Button>
        }
      />
    );
  }

  if (
    detailQuery.isError &&
    isInstitutionError(detailQuery.error) &&
    detailQuery.error.status === 503
  ) {
    return (
      <ServiceUnavailableState
        title="Person record unavailable"
        description={getInstitutionErrorMessage(detailQuery.error)}
      />
    );
  }

  if (detailQuery.isError) return <ErrorState onRetry={() => detailQuery.refetch()} />;

  if (!detailQuery.data) return null;

  const person = detailQuery.data;
  const institutionName =
    person.relationship.institutionName !== "—"
      ? person.relationship.institutionName
      : (session?.institutionName ?? "—");
  const studentId = person.relationship.studentId || person.studentIdMasked || "—";
  const consentedFields = person.sharedProfile.consentedFields ?? [];
  const credentials = credentialsQuery.data ?? person.credentials;
  const verificationHistory = verificationHistoryQuery.data ?? person.verificationActivity;

  return (
    <div className="space-y-6">
      <Link
        to="/institution/people"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> People
      </Link>

      <div className="flex flex-col gap-2 rounded-lg border border-border bg-white p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-foreground">{person.name}</h1>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <InstitutionStatusBadge status={person.institutionStatus} />
            <TrustStatusBadge status={person.trustStatus} />
            <PassportStatusBadge status={person.passportStatus} />
          </div>
        </div>
        {person.lastUpdated ? (
          <div className="text-xs text-muted-foreground">
            Last updated {formatDate(person.lastUpdated)}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Institution relationship">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <FieldCell label="Institution" value={institutionName} />
            <FieldCell label="Student ID" value={studentId} />
            <FieldCell label="Degree" value={person.relationship.degree} />
            <FieldCell label="Programme" value={person.relationship.programme} />
            <FieldCell label="Department" value={person.relationship.department} />
            <FieldCell label="Admission" value={person.relationship.admissionPeriod} />
            <FieldCell label="Graduation" value={person.relationship.graduationPeriod} />
            <FieldCell
              label="Verification"
              value={<TrustStatusBadge status={person.trustStatus} />}
            />
          </dl>
          <p className="mt-3 rounded-md border border-border bg-secondary/50 p-2 text-xs text-muted-foreground">
            Institution relationship fields are provided directly by the backend institution
            projection for this workspace.
          </p>
        </Section>

        <Section title="Shared professional profile">
          {person.sharedProfile.consented ? (
            <>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <FieldCell
                  label="Current title"
                  value={person.sharedProfile.currentTitle ?? "Not available"}
                />
                <FieldCell
                  label="Current company"
                  value={person.sharedProfile.currentCompany ?? "Not available"}
                />
              </dl>
              <div className="mt-3">
                <div className="text-xs text-muted-foreground">Consented fields</div>
                {consentedFields.length === 0 ? (
                  <div className="mt-1 text-sm text-muted-foreground">
                    No active professional fields.
                  </div>
                ) : (
                  <ul className="mt-1 flex flex-wrap gap-1.5">
                    {consentedFields.map((field) => (
                      <li
                        key={field}
                        className="inline-flex items-center rounded-full bg-[color:var(--kairo-teal-soft)] px-2 py-0.5 text-xs font-medium text-[color:var(--kairo-navy-deep)]"
                      >
                        {field === "current_title" ? "Current title" : "Current company"}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <p className="mt-3 rounded-md border border-border bg-secondary/50 p-2 text-xs text-muted-foreground">
                The backend returns only the professional fields this person has actively consented
                to share with your institution.
              </p>
            </>
          ) : (
            <div className="rounded-md border border-dashed border-border bg-secondary/40 p-4 text-sm">
              <div className="font-medium">Not shared</div>
              <p className="mt-1 text-xs text-muted-foreground">
                This person has not shared any current professional information with your
                institution.
              </p>
            </div>
          )}
        </Section>
      </div>

      <Section title="Institution credentials">
        {credentialsQuery.isLoading ? (
          <LoadingState />
        ) : credentialsQuery.isError ? (
          <div className="text-sm text-muted-foreground">
            Credential history is unavailable right now.
          </div>
        ) : credentials.length === 0 ? (
          <div className="text-sm text-muted-foreground">No credentials on file.</div>
        ) : (
          <ul className="divide-y divide-border">
            {credentials.map((credential) => (
              <li key={credential.id} className="flex flex-col gap-3 py-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-sm font-medium">{credential.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {credential.credentialType}
                      {credential.credentialNumber ? ` · ${credential.credentialNumber}` : ""}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Issued {credential.issuePeriod ?? credential.issueDate}
                      {credential.programme ? ` · ${credential.programme}` : ""}
                    </div>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                      credential.status === "issued" || credential.status === "verified"
                        ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                        : credential.status === "revoked"
                          ? "bg-slate-100 text-slate-700 ring-slate-200"
                          : "bg-amber-50 text-amber-800 ring-amber-200"
                    }`}
                  >
                    {mapCredentialStatusLabel(credential.status)}
                  </span>
                </div>
                {credential.history.length > 0 && (
                  <ol className="space-y-2 border-l border-border pl-4">
                    {credential.history.map((event) => (
                      <li
                        key={`${credential.id}-${event.at}-${event.label}`}
                        className="text-xs text-muted-foreground"
                      >
                        <div className="font-medium text-foreground">{event.label}</div>
                        <div>{formatDateTime(event.at)}</div>
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Verification activity">
        {verificationHistoryQuery.isLoading ? (
          <LoadingState />
        ) : verificationHistoryQuery.isError ? (
          <div className="text-sm text-muted-foreground">
            Verification history is unavailable right now.
          </div>
        ) : verificationHistory.length === 0 ? (
          <div className="text-sm text-muted-foreground">No verification requests yet.</div>
        ) : (
          <ul className="divide-y divide-border">
            {verificationHistory.map((event) => (
              <li key={event.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <div className="font-medium">{event.requestingOrg}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDateTime(event.date)} · Source: {event.reviewer}
                  </div>
                  {(event.previousStatus || event.newStatus) && (
                    <div className="text-xs text-muted-foreground">
                      {event.previousStatus ?? "—"} to {event.newStatus ?? "—"}
                    </div>
                  )}
                </div>
                {event.requestId ? (
                  <Link
                    to="/institution/verifications/$requestId"
                    params={{ requestId: event.requestId }}
                    className="text-xs font-medium text-[color:var(--kairo-navy)] hover:underline"
                  >
                    Open
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Activity timeline">
        {person.timeline.length === 0 ? (
          <div className="text-sm text-muted-foreground">No lifecycle events recorded yet.</div>
        ) : (
          <ol className="space-y-3">
            {person.timeline.map((event) => (
              <li key={event.id} className="flex gap-3 text-sm">
                <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[color:var(--kairo-teal)]" />
                <div>
                  <div className="font-medium">{event.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDateTime(event.at)}
                    {event.detail ? ` · ${event.detail}` : ""}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function FieldCell({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm text-foreground">{value}</div>
    </div>
  );
}
