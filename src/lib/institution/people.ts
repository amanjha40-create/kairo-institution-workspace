import type { InstitutionCredentialStatus, Person, ProfessionalField, TrustStatus } from "./types";

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
