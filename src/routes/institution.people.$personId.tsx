import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { getInstitutionPerson } from "@/lib/institution/api";
import { isInstitutionError } from "@/lib/institution/errors";
import { institutionQueryKeys } from "@/lib/institution/query-keys";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  ServiceUnavailableState,
} from "@/components/institution/PageStates";
import {
  InstitutionStatusBadge,
  PassportStatusBadge,
  TrustStatusBadge,
} from "@/components/institution/StatusBadge";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime } from "@/lib/institution/format";
import { toast } from "sonner";

export const Route = createFileRoute("/institution/people/$personId")({
  component: PersonDetailPage,
});

function PersonDetailPage() {
  const { personId } = Route.useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: institutionQueryKeys.person(personId),
    queryFn: () => getInstitutionPerson(personId),
  });

  if (isLoading) return <LoadingState />;
  if (isError && isInstitutionError(error) && error.status === 503) {
    return (
      <ServiceUnavailableState title="Person record unavailable" description={error.uiMessage} />
    );
  }
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (!data)
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

  const p = data;

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
          <h1 className="text-xl font-semibold text-foreground">{p.name}</h1>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <InstitutionStatusBadge status={p.institutionStatus} />
            <TrustStatusBadge status={p.trustStatus} />
            <PassportStatusBadge status={p.passportStatus} />
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          Last updated {formatDate(p.lastUpdated)}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Institution relationship">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <FieldCell label="Institution" value={p.relationship.institutionName} />
            <FieldCell label="Student ID" value={p.relationship.studentId} />
            <FieldCell label="Degree" value={p.relationship.degree} />
            <FieldCell label="Programme" value={p.relationship.programme} />
            <FieldCell label="Department" value={p.relationship.department} />
            <FieldCell label="Admission" value={p.relationship.admissionPeriod} />
            <FieldCell label="Graduation" value={p.relationship.graduationPeriod} />
            <FieldCell label="Verification" value={<TrustStatusBadge status={p.trustStatus} />} />
          </dl>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="outline" onClick={() => toast("Correction flow (mock)")}>
              Correct institution-owned information
            </Button>
          </div>
        </Section>

        <Section title="Shared professional profile">
          {p.sharedProfile.consented ? (
            <>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <FieldCell
                  label="Current title"
                  value={p.sharedProfile.currentTitle ?? "Not available"}
                />
                <FieldCell
                  label="Current company"
                  value={p.sharedProfile.currentCompany ?? "Not available"}
                />
                <FieldCell label="Industry" value={p.sharedProfile.industry ?? "Not available"} />
                <FieldCell label="Location" value={p.sharedProfile.location ?? "Not available"} />
              </dl>
              {(p.sharedProfile.credentials ?? []).length > 0 && (
                <div className="mt-3">
                  <div className="text-xs text-muted-foreground">Verified credentials</div>
                  <ul className="mt-1 flex flex-wrap gap-1.5">
                    {p.sharedProfile.credentials!.map((c) => (
                      <li
                        key={c.name}
                        className="inline-flex items-center gap-1 rounded-full bg-[color:var(--kairo-teal-soft)] px-2 py-0.5 text-xs font-medium text-[color:var(--kairo-navy-deep)]"
                      >
                        <ShieldCheck className="h-3 w-3" /> {c.name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="mt-3 rounded-md border border-border bg-secondary/50 p-2 text-xs text-muted-foreground">
                This information is shared by the individual through Kairo and may be withdrawn or
                updated by them.
              </p>
            </>
          ) : (
            <div className="rounded-md border border-dashed border-border bg-secondary/40 p-4 text-sm">
              <div className="font-medium">Not shared</div>
              <p className="mt-1 text-xs text-muted-foreground">
                This person has not shared their current professional information with your
                institution.
              </p>
            </div>
          )}
        </Section>
      </div>

      <Section title="Institution credentials">
        {p.credentials.length === 0 ? (
          <div className="text-sm text-muted-foreground">No credentials on file.</div>
        ) : (
          <ul className="divide-y divide-border">
            {p.credentials.map((c) => (
              <li
                key={c.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="text-sm font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Issued {c.issueDate} · Updated {c.lastUpdated}
                    {c.revokedReason ? ` · ${c.revokedReason}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                      c.status === "verified"
                        ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                        : c.status === "revoked"
                          ? "bg-slate-100 text-slate-700 ring-slate-200"
                          : c.status === "corrected"
                            ? "bg-sky-50 text-sky-800 ring-sky-200"
                            : "bg-amber-50 text-amber-800 ring-amber-200"
                    }`}
                  >
                    {c.status[0].toUpperCase() + c.status.slice(1)}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toast("View credential (mock)")}
                  >
                    View
                  </Button>
                  {c.status !== "revoked" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toast("Revocation flow (mock)")}
                    >
                      Revoke
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Verification activity">
        {p.verificationActivity.length === 0 ? (
          <div className="text-sm text-muted-foreground">No verification requests yet.</div>
        ) : (
          <ul className="divide-y divide-border">
            {p.verificationActivity.map((v) => (
              <li key={v.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <div className="font-medium">{v.requestingOrg}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(v.date)} · Reviewer: {v.reviewer}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{v.result}</span>
                  {v.requestId && (
                    <Link
                      to="/institution/verifications/$requestId"
                      params={{ requestId: v.requestId }}
                      className="text-xs font-medium text-[color:var(--kairo-navy)] hover:underline"
                    >
                      Open
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Activity timeline">
        <ol className="space-y-3">
          {p.timeline.map((t) => (
            <li key={t.id} className="flex gap-3 text-sm">
              <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[color:var(--kairo-teal)]" />
              <div>
                <div className="font-medium">{t.label}</div>
                <div className="text-xs text-muted-foreground">{formatDateTime(t.at)}</div>
              </div>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function FieldCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm text-foreground">{value}</div>
    </div>
  );
}
