import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  changeInstitutionPassword,
  getInstitutionSettings,
  revokeAllInstitutionSessions,
  revokeInstitutionSession,
  updateInstitutionAccountProfile,
  updateInstitutionNotificationPreferences,
  updateInstitutionProfile,
} from "@/lib/institution/api";
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
import { formatDateTime } from "@/lib/institution/format";
import { formatInstitutionSessionLabel } from "@/lib/institution/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export const Route = createFileRoute("/institution/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const queryClient = useQueryClient();
  const { session, refreshSession, signOut } = useInstitutionAuth();
  const permissions = getInstitutionPermissions(session);
  const organizationId = session?.institutionId;

  const settingsQuery = useQuery({
    queryKey: institutionQueryKeys.settings(organizationId),
    queryFn: () => {
      if (!organizationId) {
        throw new Error("An active institution context is required.");
      }

      return getInstitutionSettings(organizationId);
    },
    enabled: Boolean(organizationId) && permissions.canManageSettings,
  });

  const [institutionForm, setInstitutionForm] = useState<{
    name: string;
    type: string;
    website: string;
    workEmail: string;
    domain: string;
    location: string;
  } | null>(null);
  const [accountForm, setAccountForm] = useState<{
    fullName: string;
    email: string;
    phone: string;
    currentRole: string;
    location: string;
  } | null>(null);
  const [notificationForm, setNotificationForm] = useState<ReturnType<
    typeof normalizeNotificationForm
  > | null>(null);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    if (!settingsQuery.data) {
      return;
    }

    setInstitutionForm({
      name: settingsQuery.data.institution.name,
      type: settingsQuery.data.institution.type,
      website:
        settingsQuery.data.institution.website === "—"
          ? ""
          : settingsQuery.data.institution.website,
      workEmail:
        settingsQuery.data.institution.workEmail ??
        (settingsQuery.data.institution.primaryVerificationEmail === "—"
          ? ""
          : settingsQuery.data.institution.primaryVerificationEmail),
      domain:
        settingsQuery.data.institution.domain === "—" ? "" : settingsQuery.data.institution.domain,
      location: settingsQuery.data.institution.location ?? "",
    });
    setAccountForm({
      fullName: settingsQuery.data.account.fullName,
      email: settingsQuery.data.account.email,
      phone: settingsQuery.data.account.phone ?? "",
      currentRole: settingsQuery.data.account.currentRole ?? "",
      location: settingsQuery.data.account.location ?? "",
    });
    setNotificationForm(normalizeNotificationForm(settingsQuery.data.notifications));
  }, [settingsQuery.data]);

  const institutionDirty = useMemo(() => {
    if (!settingsQuery.data || !institutionForm) return false;
    return (
      JSON.stringify(institutionForm) !==
      JSON.stringify({
        name: settingsQuery.data.institution.name,
        type: settingsQuery.data.institution.type,
        website:
          settingsQuery.data.institution.website === "—"
            ? ""
            : settingsQuery.data.institution.website,
        workEmail:
          settingsQuery.data.institution.workEmail ??
          (settingsQuery.data.institution.primaryVerificationEmail === "—"
            ? ""
            : settingsQuery.data.institution.primaryVerificationEmail),
        domain:
          settingsQuery.data.institution.domain === "—"
            ? ""
            : settingsQuery.data.institution.domain,
        location: settingsQuery.data.institution.location ?? "",
      })
    );
  }, [institutionForm, settingsQuery.data]);

  const accountDirty = useMemo(() => {
    if (!settingsQuery.data || !accountForm) return false;
    return (
      JSON.stringify(accountForm) !==
      JSON.stringify({
        fullName: settingsQuery.data.account.fullName,
        email: settingsQuery.data.account.email,
        phone: settingsQuery.data.account.phone ?? "",
        currentRole: settingsQuery.data.account.currentRole ?? "",
        location: settingsQuery.data.account.location ?? "",
      })
    );
  }, [accountForm, settingsQuery.data]);

  const notificationsDirty = useMemo(() => {
    if (!settingsQuery.data || !notificationForm) return false;
    return (
      JSON.stringify(notificationForm) !==
      JSON.stringify(normalizeNotificationForm(settingsQuery.data.notifications))
    );
  }, [notificationForm, settingsQuery.data]);

  const invalidateSettings = async () => {
    await queryClient.invalidateQueries({
      queryKey: institutionQueryKeys.settings(organizationId),
    });
  };

  const institutionMutation = useMutation({
    mutationFn: async () => {
      if (!organizationId || !institutionForm) {
        throw new Error("An active institution context is required.");
      }

      return updateInstitutionProfile(organizationId, {
        name: institutionForm.name.trim(),
        website: nullableString(institutionForm.website),
        workEmail: nullableString(institutionForm.workEmail),
        domain: nullableString(institutionForm.domain),
        location: nullableString(institutionForm.location),
      });
    },
    onSuccess: async () => {
      await refreshSession();
      await invalidateSettings();
      toast.success("Institution profile updated.");
    },
    onError: (error) => {
      toast.error(getInstitutionErrorMessage(error, "We couldn't save the institution profile."));
    },
  });

  const accountMutation = useMutation({
    mutationFn: async () => {
      if (!accountForm) {
        throw new Error("Account preferences are unavailable.");
      }

      return updateInstitutionAccountProfile({
        fullName: nullableString(accountForm.fullName),
        phone: nullableString(accountForm.phone),
        currentRole: nullableString(accountForm.currentRole),
        location: nullableString(accountForm.location),
      });
    },
    onSuccess: async () => {
      await refreshSession();
      await invalidateSettings();
      toast.success("Account preferences updated.");
    },
    onError: (error) => {
      toast.error(getInstitutionErrorMessage(error, "We couldn't save account preferences."));
    },
  });

  const notificationsMutation = useMutation({
    mutationFn: async () => {
      if (!notificationForm) {
        throw new Error("Notification preferences are unavailable.");
      }

      return updateInstitutionNotificationPreferences(notificationForm);
    },
    onSuccess: async () => {
      await invalidateSettings();
      toast.success("Notification preferences updated.");
    },
    onError: (error) => {
      toast.error(getInstitutionErrorMessage(error, "We couldn't save notification preferences."));
    },
  });

  const revokeSessionMutation = useMutation({
    mutationFn: revokeInstitutionSession,
    onSuccess: async () => {
      await invalidateSettings();
      toast.success("Session revoked.");
    },
    onError: (error) => {
      toast.error(getInstitutionErrorMessage(error, "We couldn't revoke that session."));
    },
  });

  const revokeAllSessionsMutation = useMutation({
    mutationFn: revokeAllInstitutionSessions,
    onSuccess: async () => {
      toast.success("All sessions revoked.");
      await signOut().catch(() => undefined);
    },
    onError: (error) => {
      toast.error(getInstitutionErrorMessage(error, "We couldn't revoke all sessions."));
    },
  });

  const passwordMutation = useMutation({
    mutationFn: async () => {
      if (
        !passwordForm.currentPassword ||
        !passwordForm.newPassword ||
        !passwordForm.confirmPassword
      ) {
        throw new Error("Please complete all password fields.");
      }

      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        throw new Error("New passwords do not match.");
      }

      return changeInstitutionPassword(passwordForm);
    },
    onSuccess: async () => {
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      toast.success("Password updated.");
    },
    onError: (error) => {
      const message =
        error instanceof Error
          ? error.message
          : getInstitutionErrorMessage(error, "We couldn't update the password.");
      toast.error(message);
    },
  });

  if (!permissions.canManageSettings) return <PermissionDeniedState />;
  if (settingsQuery.isLoading) return <LoadingState />;
  if (
    settingsQuery.isError &&
    isInstitutionError(settingsQuery.error) &&
    settingsQuery.error.status === 503
  ) {
    return (
      <ServiceUnavailableState
        title="Settings are unavailable"
        description={settingsQuery.error.uiMessage}
      />
    );
  }
  if (
    settingsQuery.isError ||
    !settingsQuery.data ||
    !institutionForm ||
    !accountForm ||
    !notificationForm
  ) {
    return <ErrorState onRetry={() => void settingsQuery.refetch()} />;
  }

  const data = settingsQuery.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure your institution profile, account preferences, notifications, and security
          controls supported by the shared Kairo backend.
        </p>
      </div>

      <Section title="Institution profile">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Institution name"
            value={institutionForm.name}
            onChange={(value) =>
              setInstitutionForm((current) => (current ? { ...current, name: value } : current))
            }
          />
          <Field label="Institution type" value={institutionForm.type} disabled />
          <Field
            label="Website"
            value={institutionForm.website}
            onChange={(value) =>
              setInstitutionForm((current) => (current ? { ...current, website: value } : current))
            }
          />
          <Field
            label="Primary verification email"
            value={institutionForm.workEmail}
            onChange={(value) =>
              setInstitutionForm((current) =>
                current ? { ...current, workEmail: value } : current,
              )
            }
          />
          <Field
            label="Institution domain"
            value={institutionForm.domain}
            onChange={(value) =>
              setInstitutionForm((current) => (current ? { ...current, domain: value } : current))
            }
          />
          <Field
            label="Location"
            value={institutionForm.location}
            onChange={(value) =>
              setInstitutionForm((current) => (current ? { ...current, location: value } : current))
            }
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted-foreground">
          <div>
            Domain verification:{" "}
            {data.security.domainVerified
              ? `Verified${data.security.domainVerifiedAt ? ` on ${formatDateTime(data.security.domainVerifiedAt)}` : ""}`
              : "Not verified yet"}
          </div>
          <div>Ownership transfer remains available only from the Team page.</div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            disabled={!institutionDirty || institutionMutation.isPending}
            onClick={() => institutionMutation.mutate()}
          >
            {institutionMutation.isPending ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </Section>

      <Section title="Account preferences">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Full name"
            value={accountForm.fullName}
            onChange={(value) =>
              setAccountForm((current) => (current ? { ...current, fullName: value } : current))
            }
          />
          <Field label="Email" value={accountForm.email} disabled />
          <Field
            label="Phone"
            value={accountForm.phone}
            onChange={(value) =>
              setAccountForm((current) => (current ? { ...current, phone: value } : current))
            }
          />
          <Field
            label="Current role"
            value={accountForm.currentRole}
            onChange={(value) =>
              setAccountForm((current) => (current ? { ...current, currentRole: value } : current))
            }
          />
          <Field
            label="Location"
            value={accountForm.location}
            onChange={(value) =>
              setAccountForm((current) => (current ? { ...current, location: value } : current))
            }
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-4 border-t border-border pt-4 text-xs text-muted-foreground">
          <span>
            Email verification:{" "}
            {data.account.emailVerifiedAt
              ? formatDateTime(data.account.emailVerifiedAt)
              : "Not verified"}
          </span>
          <span>
            Phone verification:{" "}
            {data.account.phoneVerifiedAt
              ? formatDateTime(data.account.phoneVerifiedAt)
              : "Not verified"}
          </span>
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            disabled={!accountDirty || accountMutation.isPending}
            onClick={() => accountMutation.mutate()}
          >
            {accountMutation.isPending ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </Section>

      <Section title="Notification preferences">
        {notificationForm.length === 0 ? (
          <UnavailableMessage description="No notification preference contract is available for this institution account yet." />
        ) : (
          <>
            <div className="space-y-3">
              {notificationForm.map((preference) => (
                <ToggleRow
                  key={preference.id}
                  label={preference.label}
                  description={preference.description}
                  checked={preference.enabled}
                  disabled={preference.required}
                  onCheckedChange={(checked) =>
                    setNotificationForm((current) =>
                      current
                        ? current.map((item) =>
                            item.id === preference.id
                              ? {
                                  ...item,
                                  enabled: item.required ? true : checked,
                                }
                              : item,
                          )
                        : current,
                    )
                  }
                />
              ))}
            </div>
            <div className="mt-4 flex justify-end border-t border-border pt-4">
              <Button
                disabled={!notificationsDirty || notificationsMutation.isPending}
                onClick={() => notificationsMutation.mutate()}
              >
                {notificationsMutation.isPending ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </>
        )}
      </Section>

      <Section title="Verification preferences">
        <UnavailableMessage description="Default reviewer, assignment, SLA, and workflow-specific workspace verification preferences are not exposed by the shared backend for institution workspaces yet." />
      </Section>

      <Section title="Connected data">
        <p className="mb-4 text-xs text-muted-foreground">
          SIS, secure API, and batch-import connection management will appear here once institution
          integration contracts are approved.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <UnavailableFeatureCard
            title="Student Information System"
            description="Student lifecycle and enrolment connections are not supported yet."
          />
          <UnavailableFeatureCard
            title="Secure API"
            description="Real-time institution record lookups are not configured yet."
          />
          <UnavailableFeatureCard
            title="Batch data import"
            description="Scheduled import management is not available yet."
          />
          <UnavailableFeatureCard
            title="Security history"
            description="Administrative audit and security-history views are coming soon."
          />
        </div>
      </Section>

      <Section title="Security">
        <div className="space-y-6">
          <div>
            <div className="text-sm font-medium">Active sessions</div>
            {data.sessions.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">No active sessions found.</p>
            ) : (
              <ul className="mt-2 divide-y divide-border rounded-md border border-border">
                {data.sessions.map((activeSession) => (
                  <li
                    key={activeSession.id}
                    className="flex flex-col gap-3 px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="font-medium">
                        {formatInstitutionSessionLabel(activeSession)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Last active {formatDateTime(activeSession.lastActiveAt)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Expires {formatDateTime(activeSession.expiresAt)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Device details unavailable from the current backend contract.
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={revokeSessionMutation.isPending}
                      onClick={() => revokeSessionMutation.mutate(activeSession.id)}
                    >
                      Revoke
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <Button
              variant="outline"
              className="mt-3"
              disabled={revokeAllSessionsMutation.isPending}
              onClick={() => revokeAllSessionsMutation.mutate()}
            >
              {revokeAllSessionsMutation.isPending ? "Signing out..." : "Sign out all sessions"}
            </Button>
          </div>

          <div className="border-t border-border pt-4">
            <div className="text-sm font-medium">Password</div>
            {data.security.canChangePassword ? (
              <>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Current password"
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(value) =>
                      setPasswordForm((current) => ({ ...current, currentPassword: value }))
                    }
                  />
                  <Field
                    label="New password"
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(value) =>
                      setPasswordForm((current) => ({ ...current, newPassword: value }))
                    }
                  />
                  <Field
                    label="Confirm new password"
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(value) =>
                      setPasswordForm((current) => ({ ...current, confirmPassword: value }))
                    }
                  />
                </div>
                <div className="mt-3 flex justify-end">
                  <Button
                    disabled={passwordMutation.isPending}
                    onClick={() => passwordMutation.mutate()}
                  >
                    {passwordMutation.isPending ? "Updating..." : "Update password"}
                  </Button>
                </div>
              </>
            ) : (
              <UnavailableMessage description="Password updates are not available for this account type yet." />
            )}
          </div>

          <div className="border-t border-border pt-4">
            <div className="text-sm font-medium">Additional security controls</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <UnavailableFeatureCard
                title="Multi-factor authentication"
                description="MFA setup is not available through the current institution workspace contract."
              />
              <UnavailableFeatureCard
                title="Security history"
                description="Recent security events and audit history are not available yet."
              />
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}

function normalizeNotificationForm(
  notifications: Awaited<ReturnType<typeof getInstitutionSettings>>["notifications"],
) {
  return notifications.map((preference) => ({
    ...preference,
    enabled: preference.required ? true : preference.enabled,
  }));
}

function nullableString(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
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

function Field({
  label,
  value,
  onChange,
  type = "text",
  disabled = false,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.value)}
      />
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-border/70 px-3 py-3">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onCheckedChange(value === true)}
      />
    </div>
  );
}

function UnavailableMessage({ description }: { description: string }) {
  return <p className="text-sm text-muted-foreground">{description}</p>;
}

function UnavailableFeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-secondary/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium">{title}</div>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 ring-1 ring-inset ring-slate-200">
          Coming soon
        </span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
