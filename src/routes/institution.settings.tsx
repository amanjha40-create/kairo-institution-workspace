import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getInstitutionSettings } from "@/lib/institution/api";
import {
  ErrorState,
  LoadingState,
  PermissionDeniedState,
  ServiceUnavailableState,
} from "@/components/institution/PageStates";
import { getInstitutionErrorMessage, isInstitutionError } from "@/lib/institution/errors";
import { getInstitutionPermissions } from "@/lib/institution/permissions";
import { institutionQueryKeys } from "@/lib/institution/query-keys";
import { useInstitutionAuth } from "@/lib/institution/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/institution/format";

export const Route = createFileRoute("/institution/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { session } = useInstitutionAuth();
  const permissions = getInstitutionPermissions(session);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: institutionQueryKeys.settings(),
    queryFn: getInstitutionSettings,
  });

  if (!permissions.canManageSettings) return <PermissionDeniedState />;
  if (isLoading) return <LoadingState />;
  if (isError && isInstitutionError(error) && error.status === 503) {
    return (
      <ServiceUnavailableState title="Settings are unavailable" description={error.uiMessage} />
    );
  }
  if (isError || !data) return <ErrorState onRetry={() => refetch()} />;

  const s = data;
  const ownerOnlyMessage = permissions.canManageOwnerActions
    ? null
    : "Only Owners can change institution profile and security controls. Backend enforcement is still required.";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure your institution's profile, verification preferences, connected data, and
          security.
        </p>
      </div>

      <Section title="Institution profile">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Institution name" defaultValue={s.institution.name} />
          <Field label="Institution type" defaultValue={s.institution.type} />
          <Field label="Website" defaultValue={s.institution.website} />
          <Field
            label="Primary verification email"
            defaultValue={s.institution.primaryVerificationEmail}
          />
          <Field label="Institution domain" defaultValue={s.institution.domain} />
          <Field label="Official address" defaultValue={s.institution.address} />
        </div>
        {ownerOnlyMessage && (
          <p className="mt-3 text-xs text-muted-foreground">{ownerOnlyMessage}</p>
        )}
        <div className="mt-4 flex justify-end">
          <Button
            disabled={!permissions.canManageOwnerActions}
            onClick={() => toast.error("Institution settings are not writable yet.")}
          >
            Save changes
          </Button>
        </div>
      </Section>

      <Section title="Verification preferences">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Default reviewer" defaultValue={s.preferences.defaultReviewer} />
          <Field label="Default response email" defaultValue={s.preferences.defaultResponseEmail} />
          <Field
            label="Response target (hours)"
            defaultValue={String(s.preferences.responseSlaHours ?? "")}
          />
          <Field label="Assignment preference" defaultValue={s.preferences.assignmentPreference} />
        </div>
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <ToggleRow
            label="Notify on new request"
            description="Email the default reviewer when a new request arrives."
            defaultChecked={s.preferences.notifyOnNewRequest}
          />
          <ToggleRow
            label="Notify on clarification response"
            description="Email the reviewer when candidates respond to clarifications."
            defaultChecked={s.preferences.notifyOnClarification}
          />
        </div>
      </Section>

      <Section title="Connected data">
        <p className="mb-4 text-xs text-muted-foreground">
          Connect your institution's data sources so verification requests can be matched
          automatically. Kairo's institution integration team will help you configure a secure
          connection.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <IntegrationCard
            title="Student Information System"
            description="Sync programme, enrolment, and graduation records."
            status={s.connectedData.sisStatus}
          />
          <IntegrationCard
            title="Institution database"
            description="Direct connection to your institution's registrar database."
            status={s.connectedData.databaseStatus}
          />
          <IntegrationCard
            title="Secure API"
            description="Real-time API for on-demand record lookups."
            status={s.connectedData.apiStatus}
          />
          <IntegrationCard
            title="Batch data import"
            description="Scheduled CSV or file-based data imports."
            status={s.connectedData.batchImportStatus}
          />
        </div>
      </Section>

      <Section title="Security">
        <div className="space-y-4">
          <div>
            <div className="text-sm font-medium">Institution domain verification</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {s.security.domainVerified ? `Verified for ${s.institution.domain}` : "Not verified"}
            </div>
          </div>
          <div className="border-t border-border pt-4">
            <div className="text-sm font-medium">Active sessions</div>
            <ul className="mt-2 divide-y divide-border rounded-md border border-border">
              {s.security.activeSessions.map((sess) => (
                <li key={sess.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <div>
                    <div>{sess.device}</div>
                    <div className="text-xs text-muted-foreground">
                      {sess.location} · {formatDateTime(sess.lastActive)}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!permissions.canManageOwnerActions}
                    onClick={() => toast.error("Session revocation is not available yet.")}
                  >
                    Revoke
                  </Button>
                </li>
              ))}
            </ul>
            <Button
              variant="outline"
              className="mt-3"
              disabled={!permissions.canManageOwnerActions}
              onClick={() => toast.error("Global session revocation is not available yet.")}
            >
              Sign out all sessions
            </Button>
          </div>
          <div className="border-t border-border pt-4">
            <div className="text-sm font-medium">Password</div>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <Field label="Current password" type="password" />
              <Field label="New password" type="password" />
            </div>
            <div className="mt-3 flex justify-end">
              <Button onClick={() => toast.error("Password updates are not available yet.")}>
                Update password
              </Button>
            </div>
          </div>
        </div>
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

function Field({
  label,
  defaultValue,
  type = "text",
}: {
  label: string;
  defaultValue?: string;
  type?: string;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input type={type} defaultValue={defaultValue} />
    </div>
  );
}

function ToggleRow({
  label,
  description,
  defaultChecked,
}: {
  label: string;
  description: string;
  defaultChecked?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <Switch defaultChecked={defaultChecked} />
    </div>
  );
}

function IntegrationCard({
  title,
  description,
  status,
}: {
  title: string;
  description: string;
  status: "not_connected" | "pending" | "connected" | "error";
}) {
  const statusLabel = {
    not_connected: "Not Connected",
    pending: "Connection Pending",
    connected: "Connected",
    error: "Connection Error",
  }[status];
  const tone = {
    not_connected: "bg-slate-100 text-slate-700 ring-slate-200",
    pending: "bg-amber-50 text-amber-800 ring-amber-200",
    connected: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    error: "bg-rose-50 text-rose-800 ring-rose-200",
  }[status];
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="mt-1 text-xs text-muted-foreground">{description}</div>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tone}`}>
          {statusLabel}
        </span>
      </div>
    </div>
  );
}
