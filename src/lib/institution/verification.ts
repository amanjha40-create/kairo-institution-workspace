import type {
  CandidateClaim,
  VerificationOriginType,
  VerificationRequestType,
  VerificationStatus,
} from "./types";

export function getVerificationReference(id: string) {
  const short = id.split("-")[0]?.toUpperCase() ?? id;
  return `VR-${short}`;
}

export function getVerificationRequestTypeLabel(requestType?: string | null) {
  if (!requestType) return "Verification";

  return requestType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getVerificationOriginLabel(originType?: VerificationOriginType | null) {
  switch (originType) {
    case "subject_initiated":
      return "Candidate-submitted";
    case "organization_created":
      return "Organization-created";
    case "trust_invitation":
      return "Invitation";
    case "admin_created":
      return "Admin-created";
    case "api":
      return "API";
    case "system":
      return "System";
    default:
      return "Verification request";
  }
}

export function getVerificationNextAction(status: VerificationStatus) {
  switch (status) {
    case "pending_organization_acceptance":
    case "pending_organization_resolution":
    case "approved_for_organization_verification":
    case "accepted":
      return "Review submitted claim";
    case "awaiting_information":
    case "awaiting_clarification":
      return "Await candidate clarification";
    case "in_progress":
      return "Complete institution review";
    case "pending_admin_review":
    case "pending_admin_re_review":
      return "Await Kairo review";
    case "awaiting_subject_corrections":
      return "Await candidate corrections";
    case "pending_subject_acceptance":
      return "Await candidate acceptance";
    case "pending_subject_submission":
      return "Await candidate evidence";
    case "verified":
    case "confirmed":
      return "Completed";
    case "rejected":
    case "discrepancy":
      return "Unable to verify";
    case "cancelled":
    case "expired":
    case "closed":
      return "Closed";
    default:
      return "Review request";
  }
}

export function getVerificationStatusCategory(status: VerificationStatus) {
  switch (status) {
    case "awaiting_information":
    case "awaiting_clarification":
    case "awaiting_subject_corrections":
      return "awaiting_clarification" as const;
    case "in_progress":
    case "approved_for_organization_verification":
    case "pending_organization_resolution":
      return "in_progress" as const;
    case "verified":
    case "confirmed":
    case "rejected":
    case "discrepancy":
    case "cancelled":
    case "expired":
    case "closed":
      return "completed" as const;
    default:
      return "pending" as const;
  }
}

function readFirstString(
  trustContext: Record<string, unknown> | undefined,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = trustContext?.[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

export function buildCandidateClaimFromTrustContext(args: {
  trustContext?: Record<string, unknown>;
  candidateName: string;
  institutionName?: string;
  requestType?: VerificationRequestType;
  candidateResponse?: string | null;
  consentedFields?: string[];
}) {
  // Temporary backend-contract limitation:
  // the shared verification-request payload does not yet expose a typed education claim,
  // so Institution Milestone 3 derives the display claim from trust_context until the
  // institution-specific claim contract is added server-side.
  const {
    trustContext,
    candidateName,
    institutionName,
    requestType,
    candidateResponse,
    consentedFields,
  } = args;

  const requestedFields = Array.isArray(trustContext?.requested_fields)
    ? trustContext.requested_fields.filter((value): value is string => typeof value === "string")
    : [];

  const additionalNotes = [
    candidateResponse?.trim(),
    requestedFields.length > 0 ? `Requested fields: ${requestedFields.join(", ")}` : undefined,
    consentedFields && consentedFields.length > 0
      ? `Consented fields: ${consentedFields.join(", ")}`
      : undefined,
  ].filter(Boolean);

  return {
    candidateName,
    studentId: readFirstString(trustContext, ["student_id", "studentId", "candidate_id"]),
    institutionName:
      readFirstString(trustContext, [
        "institution_name",
        "institutionName",
        "university_name",
        "universityName",
      ]) ||
      institutionName ||
      "—",
    degree: readFirstString(trustContext, ["degree", "qualification", "credential_name"]) || "—",
    programme:
      readFirstString(trustContext, ["programme", "program", "program_name", "field_of_study"]) ||
      "—",
    department: readFirstString(trustContext, ["department", "faculty", "school"]) || "—",
    admissionYear:
      readFirstString(trustContext, [
        "admission_year",
        "admissionYear",
        "start_year",
        "startYear",
      ]) || "—",
    graduationYear:
      readFirstString(trustContext, [
        "graduation_year",
        "graduationYear",
        "completion_year",
        "completionYear",
      ]) || "—",
    completionStatus:
      readFirstString(trustContext, ["completion_status", "completionStatus", "status"]) ||
      (requestType
        ? `${getVerificationRequestTypeLabel(requestType)} claim submitted`
        : "Submitted"),
    additionalNote: additionalNotes.length > 0 ? additionalNotes.join(" · ") : undefined,
  } satisfies CandidateClaim;
}

export function formatVerificationTimelineLabel(eventType: string) {
  const normalized = eventType.replace(/^verification_request_/, "").replace(/^verification_/, "");
  return normalized
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
