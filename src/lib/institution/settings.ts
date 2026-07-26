import type { InstitutionAccountSession, InstitutionNotificationPreference } from "./types";

const organizationTypeLabels: Record<string, string> = {
  university: "University",
  employer: "Employer",
  staffing_agency: "Staffing Agency",
  background_verification_partner: "Background Verification Partner",
  government: "Government",
  certification_body: "Certification Body",
  hospital: "Hospital",
  gig_platform: "Contractor Platform",
  financial_institution: "Financial Institution",
  other: "Other",
};

const notificationPreferenceMetadata: Record<
  string,
  { label: string; description: string; required?: boolean }
> = {
  trust_invitation_created: {
    label: "Trust invitation",
    description: "Notifications about Trust Invitations relevant to your institution.",
  },
  verification_completed: {
    label: "Verification completed",
    description: "Notifications when a verification request reaches a final resolution.",
  },
  password_reset_requested: {
    label: "Password reset requested",
    description: "Security notifications for password reset requests.",
    required: true,
  },
};

export function mapInstitutionOrganizationType(type: string | null | undefined) {
  if (!type) return "University";
  return organizationTypeLabels[type] ?? type.replaceAll("_", " ");
}

export function humanizeNotificationEvent(eventType: string) {
  return eventType
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function mapInstitutionNotificationPreference(input: {
  id: string;
  eventType: string;
  enabled: boolean;
  preferredChannels: string[];
}): InstitutionNotificationPreference {
  const metadata = notificationPreferenceMetadata[input.eventType];

  return {
    id: input.id,
    eventType: input.eventType,
    label: metadata?.label ?? humanizeNotificationEvent(input.eventType),
    description:
      metadata?.description ?? "Notification preferences for this account event are configurable.",
    enabled: metadata?.required ? true : input.enabled,
    preferredChannels: input.preferredChannels,
    required: Boolean(metadata?.required),
  };
}

export function buildInstitutionNotificationPreferencePayload(
  preferences: InstitutionNotificationPreference[],
) {
  return preferences.map((preference) => ({
    event_type: preference.eventType,
    enabled: preference.required ? true : preference.enabled,
    preferred_channels: preference.preferredChannels,
    quiet_hours: {},
    metadata: {},
  }));
}

export function formatInstitutionSessionLabel(session: InstitutionAccountSession) {
  if (session.current) {
    return "Current session";
  }

  return `Session ${session.id.slice(0, 8)}`;
}
