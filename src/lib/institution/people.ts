import type {
  InstitutionCredentialStatus,
  PassportStatus,
  Person,
  ProfessionalField,
  SharedProfessionalProfile,
  TrustStatus,
} from "./types";

export function getProfessionalFieldLabel(field: ProfessionalField) {
  switch (field) {
    case "current_title":
      return "Current title";
    case "current_employer":
      return "Current company";
    default:
      return String(field).replaceAll("_", " ");
  }
}

export function derivePassportStatusFromProfile(
  profile: SharedProfessionalProfile,
): PassportStatus {
  const consentedFields = profile.consentedFields ?? [];
  const sharedFields = new Set(profile.fields?.map((field) => field.field) ?? []);

  if (consentedFields.length === 0 && sharedFields.size === 0) {
    return "not_connected";
  }

  if (consentedFields.length > sharedFields.size) {
    return "sharing_limited";
  }

  return sharedFields.size > 0 ? "connected" : "not_connected";
}

export function deriveLastUpdated(
  person: Pick<Person, "credentials" | "timeline" | "verificationActivity">,
) {
  const timestamps = [
    ...person.timeline.map((event) => event.at),
    ...person.verificationActivity.map((event) => event.date),
    ...person.credentials.flatMap((credential) => [
      credential.lastUpdated,
      ...credential.history.map((event) => event.at),
    ]),
  ].filter(Boolean);

  if (timestamps.length === 0) {
    return undefined;
  }

  return timestamps.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
}

export function mapInstitutionVerificationStatus(status: string): TrustStatus {
  switch (status) {
    case "verified":
      return "verified";
    case "discrepancy":
      return "discrepancy";
    case "clarification_required":
      return "clarification_required";
    case "rejected":
      return "rejected";
    case "expired":
      return "expired";
    case "pending":
      return "pending";
    case "not_started":
    default:
      return "not_started";
  }
}

export function mapCredentialStatusLabel(status: InstitutionCredentialStatus) {
  switch (status) {
    case "issued":
      return "Issued";
    case "revoked":
      return "Revoked";
    case "superseded":
      return "Superseded";
    case "verified":
      return "Verified";
    case "pending":
      return "Pending";
    case "corrected":
      return "Corrected";
    default:
      return status;
  }
}
