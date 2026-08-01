import { institutionAppConfig } from "./config";
import {
  InstitutionError,
  apiNotConfiguredError,
  conflictError,
  forbiddenError,
  invalidCredentialsError,
  notFoundError,
  serviceUnavailableError,
  unauthorizedError,
} from "./errors";
import type {
  InstitutionDashboard,
  InstitutionNotificationCenter,
  InstitutionPassportSummary,
  Institution,
  InstitutionCredential,
  InstitutionSettings,
  InstitutionTeam,
  InstitutionVerificationInbox,
  InternalNote,
  InstitutionWorkspaceBootstrap,
  Person,
  TimelineEvent,
  TeamInvitation,
  TeamMember,
  VerificationRequest,
  VerificationPriority,
  VerificationStatus,
} from "./types";
import { deriveLastUpdated, mapInstitutionVerificationStatus } from "./people";
import { mapInstitutionNotificationPreference, mapInstitutionOrganizationType } from "./settings";
import {
  buildCandidateClaimFromTrustContext,
  formatVerificationTimelineLabel,
  getVerificationNextAction,
  getVerificationOriginLabel,
  getVerificationReference,
  getVerificationRequestTypeLabel,
} from "./verification";

const AUTH_STORAGE_KEY = "kairo.institution.auth.tokens";

interface BackendErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
  };
}

interface BackendTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

interface BackendWorkspaceBootstrapResponse {
  state: InstitutionWorkspaceBootstrap["state"];
  current_user: {
    id: string;
    email: string;
    full_name: string | null;
    role: string;
    active_organization_public_id: string | null;
  };
  active_organization: {
    public_id: string;
    name: string;
    organization_type: string;
    website: string | null;
    location: string | null;
    work_email: string | null;
    domain: string | null;
    verification_state: InstitutionWorkspaceBootstrap["organizationVerificationState"];
    setup_completed_at: string | null;
    suspended_at: string | null;
  } | null;
  membership_role: InstitutionWorkspaceBootstrap["membershipRole"];
  organization_verification_state: InstitutionWorkspaceBootstrap["organizationVerificationState"];
  organization_suspended: boolean;
  membership_suspended: boolean;
  setup_completed: boolean;
  permission_flags: {
    invite_candidate: boolean;
    modify_person: boolean;
    modify_invitation: boolean;
    modify_verification: boolean;
    manage_team: boolean;
    save_settings: boolean;
    transfer_ownership: boolean;
  };
}

interface BackendOrganizationResponse {
  public_id: string;
  name: string;
  organization_type: string;
  website: string | null;
  industry: string | null;
  location: string | null;
  work_email: string | null;
  domain: string | null;
  domain_verified_at: string | null;
  verification_state: InstitutionWorkspaceBootstrap["organizationVerificationState"];
  setup_completed_at: string | null;
  suspended_at: string | null;
  suspension_reason: string | null;
  member_count?: number;
  created_at?: string;
  updated_at?: string;
}

interface BackendNotificationPreferenceResponse {
  public_id: string;
  event_type: string;
  enabled: boolean;
  preferred_channels: string[];
}

interface BackendAccountSettingsResponse {
  profile: BackendUserProfileResponse;
  notification_preferences: BackendNotificationPreferenceResponse[];
}

interface BackendAccountSessionResponse {
  id: string;
  created_at: string;
  expires_at: string;
  last_active_at: string;
  current: boolean;
  device: string | null;
  browser: string | null;
  location: string | null;
}

interface BackendUserProfileResponse {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  current_role: string | null;
  location: string | null;
  email_verified_at: string | null;
  phone_verified_at: string | null;
}

interface BackendOrganizationMemberResponse {
  public_id: string;
  organization_public_id: string;
  role: TeamMember["role"];
  user_email: string;
  user_full_name: string | null;
  suspended_at: string | null;
  suspension_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface BackendOrganizationInvitationResponse {
  public_id: string;
  organization_public_id: string;
  invitee_email: string;
  invitee_user_id: string | null;
  role: TeamInvitation["role"];
  status: TeamInvitation["status"];
  invited_by_email: string | null;
  invited_by_full_name: string | null;
  invited_at: string;
  expires_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

interface BackendVerificationReviewerResponse {
  user_id: string;
  full_name: string | null;
  email: string;
  role: string;
}

interface BackendInstitutionVerificationInboxItemResponse {
  public_id: string;
  subject_name: string;
  request_type: VerificationRequest["requestType"];
  status: VerificationStatus;
  priority: VerificationPriority;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  assigned_reviewer_name: string | null;
  education_institution_name: string | null;
  education_degree: string | null;
}

interface BackendInstitutionVerificationInboxResponse {
  items: BackendInstitutionVerificationInboxItemResponse[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  offset: number;
  limit: number;
}

interface BackendInstitutionComparisonFieldResponse {
  key: string;
  candidate_value: string | null;
  institution_value: string | null;
  outcome: "match" | "different" | "unavailable";
}

interface BackendInstitutionComparisonClaimResponse {
  institution_name: string | null;
  degree: string | null;
  programme: string | null;
  admission: BackendInstitutionPeriodResponse;
  graduation: BackendInstitutionPeriodResponse;
}

interface BackendInstitutionComparisonRecordResponse {
  found: boolean;
  student_id: string | null;
  degree: string | null;
  programme: string | null;
  department: string | null;
  admission: BackendInstitutionPeriodResponse;
  graduation: BackendInstitutionPeriodResponse;
  verification_status: string | null;
}

interface BackendInstitutionVerificationComparisonResponse {
  match_status: VerificationRequest["matchStatus"];
  candidate_claim: BackendInstitutionComparisonClaimResponse;
  institution_record: BackendInstitutionComparisonRecordResponse;
  fields?: BackendInstitutionComparisonFieldResponse[];
}

interface BackendInstitutionVerificationDetailResponse {
  public_id: string;
  subject_name: string;
  request_type: VerificationRequest["requestType"];
  status: VerificationStatus;
  priority: VerificationPriority;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  assigned_reviewer_name: string | null;
  education_institution_name: string | null;
  education_degree: string | null;
  organization_internal_note: string | null;
  candidate_response: string | null;
  candidate_response_submitted_at: string | null;
  consented_fields: string[];
  consented_evidence_scope: string[];
  comparison: BackendInstitutionVerificationComparisonResponse;
}

interface BackendVerificationRequestResponse {
  public_id: string;
  employment_id: string | null;
  origin_type: VerificationRequest["originType"] | null;
  organization_public_id: string | null;
  trust_invitation_public_id: string | null;
  subject_name: string;
  subject_email: string;
  target_organization_name: string | null;
  target_organization_email: string | null;
  request_type: VerificationRequest["requestType"];
  status: VerificationStatus;
  due_date: string | null;
  trust_context: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  candidate_response: string | null;
  candidate_response_submitted_at: string | null;
  accepted_at: string | null;
  consented_fields: string[];
  consented_evidence_scope: string[];
  target_organization_metadata: Record<string, unknown>;
  assigned_reviewer: BackendVerificationReviewerResponse | null;
  review_status: string | null;
  is_assigned_to_current_user: boolean | null;
  organization_internal_note: string | null;
  evidence_summary: {
    total_items: number;
    document_items: number;
    field_keys: string[];
  };
}

interface BackendVerificationEvidenceResponse {
  public_id: string;
  evidence_type: string;
  field_key: string;
  document_id: string | null;
  employment_document_id: string | null;
  value: Record<string, unknown> | null;
  status: string;
  created_at: string;
  updated_at: string;
  document_type: string | null;
  original_filename: string | null;
  mime_type: string | null;
  file_size: number | null;
  upload_status: string | null;
  download_url: string | null;
  download_url_expires_in_seconds: number | null;
}

interface BackendVerificationTimelineEventResponse {
  public_id: string;
  event_type: string;
  event_source: string;
  previous_status: string | null;
  new_status: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface BackendVerificationTimelineResponse {
  verification_request_public_id: string;
  items: BackendVerificationTimelineEventResponse[];
}

interface BackendPageResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  offset: number;
  limit: number;
}

interface BackendInstitutionPeriodResponse {
  date: string | null;
  period: string | null;
}

interface BackendInstitutionProfessionalFieldValueResponse {
  field: "current_title" | "current_employer";
  value: string;
  consented_at: string;
  expires_at: string | null;
}

interface BackendInstitutionPersonListItemResponse {
  public_id: string;
  display_name: string;
  student_id_masked: string | null;
  lifecycle_status: Person["institutionStatus"];
  degree: string | null;
  programme: string | null;
  department: string | null;
  admission: BackendInstitutionPeriodResponse;
  graduation: BackendInstitutionPeriodResponse;
  verification_status: string;
  active_verification_count: number;
  professional_information: BackendInstitutionProfessionalFieldValueResponse[];
}

interface BackendInstitutionVerificationEventResponse {
  public_id: string;
  request_public_id: string;
  event_type: string;
  event_source: string;
  previous_status: string | null;
  new_status: string | null;
  created_at: string;
}

interface BackendInstitutionCredentialEventResponse {
  public_id: string;
  event_type: string;
  previous_status: string | null;
  new_status: string | null;
  created_at: string;
}

interface BackendInstitutionCredentialResponse {
  public_id: string;
  credential_type: string;
  title: string;
  degree: string | null;
  programme: string | null;
  department: string | null;
  issued: BackendInstitutionPeriodResponse;
  credential_number: string | null;
  status: string;
  version: number;
  events: BackendInstitutionCredentialEventResponse[];
}

interface BackendInstitutionPassportCredentialSummaryResponse {
  public_id: string;
  title: string;
  credential_type: string;
  status: InstitutionCredential["status"];
  issued: BackendInstitutionPeriodResponse;
}

interface BackendInstitutionPassportSummaryResponse {
  person_public_id: string;
  display_name: string;
  lifecycle_status: Person["institutionStatus"];
  degree: string | null;
  programme: string | null;
  department: string | null;
  admission: BackendInstitutionPeriodResponse;
  graduation: BackendInstitutionPeriodResponse;
  verification_status: string;
  consented_professional_fields: Array<"current_title" | "current_employer">;
  professional_information: BackendInstitutionProfessionalFieldValueResponse[];
  credentials: BackendInstitutionPassportCredentialSummaryResponse[];
}

interface BackendInstitutionDashboardCredentialResponse {
  public_id: string;
  title: string;
  credential_type: string;
  status: InstitutionCredential["status"];
  updated_at: string;
}

interface BackendInstitutionDashboardActivityResponse {
  request_public_id: string;
  event_type: string;
  event_source: string;
  created_at: string;
}

interface BackendInstitutionPeopleSummaryResponse {
  total: number;
  current_student: number;
  alumni: number;
  withdrawn: number;
  inactive: number;
}

interface BackendInstitutionDashboardStatisticsResponse {
  total_verifications: number;
  verified_verifications: number;
  awaiting_information: number;
  high_priority: number;
}

interface BackendInstitutionDashboardResponse {
  pending_verifications: number;
  recently_verified_credentials: BackendInstitutionDashboardCredentialResponse[];
  verification_activity: BackendInstitutionDashboardActivityResponse[];
  people: BackendInstitutionPeopleSummaryResponse;
  statistics: BackendInstitutionDashboardStatisticsResponse;
}

interface BackendUserNotificationResponse {
  public_id: string;
  category: string;
  event_type: string;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

interface BackendNotificationUnreadCountResponse {
  unread_count: number;
}

interface BackendInstitutionPersonDetailResponse extends BackendInstitutionPersonListItemResponse {
  student_id: string | null;
  consented_professional_fields: Array<"current_title" | "current_employer">;
  verification_history: BackendInstitutionVerificationEventResponse[];
  credentials: BackendInstitutionCredentialResponse[];
  lifecycle_events: Array<{
    public_id: string;
    previous_status: string | null;
    new_status: string | null;
    reason: string | null;
    created_at: string;
  }>;
}

interface ApiRequestOptions extends RequestInit {
  invalidCredentials?: boolean;
  unauthorizedUiMessage?: string;
}

export interface StoredInstitutionAuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresAt: string;
}

export interface OrganizationSignupStartResult {
  signupSessionId: string;
  emailMasked: string;
  emailVerified: boolean;
  resendAfterSeconds: number;
  expiresInSeconds: number;
  message: string;
}

export interface OrganizationSignupEmailSendResult {
  signupSessionId: string;
  emailMasked: string;
  emailVerified: boolean;
  resendAfterSeconds: number;
  expiresInSeconds: number;
  message: string;
}

export interface OrganizationSignupEmailVerifyResult {
  signupSessionId: string;
  emailVerified: boolean;
  message: string;
}

export interface InstitutionOnboardingPayload {
  name: string;
  website?: string;
  location?: string;
  workEmail?: string;
  domain?: string;
}

export interface CreateOrganizationInvitationInput {
  inviteeEmail: string;
  role: TeamInvitation["role"];
}

export interface UpdateOrganizationMemberRoleInput {
  role: Exclude<TeamMember["role"], "owner">;
}

export interface SuspendOrganizationMemberInput {
  reason?: string;
}

export interface AssignVerificationReviewerInput {
  organizationMemberPublicId?: string;
}

export interface VerificationRequestActionInput {
  note?: string;
  metadata?: Record<string, unknown>;
}

export interface InstitutionPeopleQueryInput {
  search?: string;
  lifecycleStatus?: Person["institutionStatus"] | "all";
  programme?: string;
  department?: string;
  graduationPeriod?: string;
  studentId?: string;
  verificationStatus?: string | "all";
  pageSize?: number;
}

export interface InstitutionVerificationInboxQueryInput {
  search?: string;
  status?: VerificationStatus | "all";
  priority?: VerificationPriority | "all";
  requestType?: VerificationRequest["requestType"] | "all";
  assignedToMe?: boolean;
  sortBy?: "created_at" | "updated_at" | "due_date" | "priority" | "status";
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

function getApiBaseUrl(feature: string) {
  const base = institutionAppConfig.apiBaseUrl?.trim();
  if (!base) {
    throw apiNotConfiguredError(feature);
  }
  return base.replace(/\/+$/, "");
}

function buildApiUrl(path: string, feature: string) {
  const base = getApiBaseUrl(feature);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (base.endsWith("/api/v1") && normalizedPath.startsWith("/api/v1/")) {
    return `${base}${normalizedPath.slice("/api/v1".length)}`;
  }

  return `${base}${normalizedPath}`;
}

function buildQueryString(params: Record<string, string | number | boolean | undefined>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    searchParams.set(key, String(value));
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function safeReadAuthTokens(): StoredInstitutionAuthTokens | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredInstitutionAuthTokens) : null;
  } catch {
    return null;
  }
}

function safeWriteAuthTokens(value: StoredInstitutionAuthTokens | null) {
  if (typeof window === "undefined") return;

  try {
    if (!value) {
      window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
      return;
    }

    window.sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Best effort only.
  }
}

async function parseError(response: Response, options: ApiRequestOptions) {
  let payload: BackendErrorEnvelope | null = null;

  try {
    payload = (await response.json()) as BackendErrorEnvelope;
  } catch {
    payload = null;
  }

  const message =
    payload?.error?.message || `Institution backend request failed with status ${response.status}.`;

  if (response.status === 401) {
    if (options.invalidCredentials) {
      return invalidCredentialsError();
    }

    if (options.unauthorizedUiMessage) {
      return new InstitutionError({
        code: "UNAUTHORIZED",
        message,
        uiMessage: options.unauthorizedUiMessage,
        status: 401,
      });
    }

    return unauthorizedError();
  }

  if (response.status === 403) {
    return forbiddenError(message);
  }

  if (response.status === 404) {
    return notFoundError(message);
  }

  if (response.status === 409) {
    return conflictError(message);
  }

  if (response.status === 422) {
    return new InstitutionError({
      code: "VALIDATION",
      message,
      uiMessage: message,
      status: 422,
    });
  }

  if (response.status >= 500) {
    return serviceUnavailableError(message, message);
  }

  return new InstitutionError({
    code: "SERVICE_UNAVAILABLE",
    message,
    uiMessage: message,
    status: response.status,
    retryable: response.status >= 500,
  });
}

async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
  accessToken?: string,
): Promise<T> {
  const { invalidCredentials, unauthorizedUiMessage, headers, ...init } = options;
  const response = await fetch(buildApiUrl(path, "Institution authentication"), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
  });

  if (!response.ok) {
    throw await parseError(response, { invalidCredentials, unauthorizedUiMessage });
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function mapOrganizationMember(payload: BackendOrganizationMemberResponse): TeamMember {
  return {
    id: payload.public_id,
    name: payload.user_full_name || payload.user_email,
    email: payload.user_email,
    role: payload.role,
    status: payload.suspended_at ? "suspended" : "active",
    suspendedReason: payload.suspension_reason,
  };
}

function mapOrganizationInvitation(payload: BackendOrganizationInvitationResponse): TeamInvitation {
  return {
    id: payload.public_id,
    email: payload.invitee_email,
    role: payload.role,
    status: payload.status,
    invitedByEmail: payload.invited_by_email,
    invitedByName: payload.invited_by_full_name,
    invitedAt: payload.invited_at,
    expiresAt: payload.expires_at,
    acceptedAt: payload.accepted_at,
    declinedAt: payload.declined_at,
    cancelledAt: payload.cancelled_at,
  };
}

function mapInstitutionOrganization(payload: BackendOrganizationResponse): Institution {
  return {
    id: payload.public_id,
    name: payload.name,
    type: mapInstitutionOrganizationType(payload.organization_type),
    website: payload.website || "—",
    address: payload.location || "—",
    primaryVerificationEmail: payload.work_email || "—",
    domain: payload.domain || "—",
    location: payload.location,
    workEmail: payload.work_email,
    industry: payload.industry,
    verificationState: payload.verification_state,
    domainVerifiedAt: payload.domain_verified_at,
    suspendedAt: payload.suspended_at,
  };
}

function mapInstitutionAccountProfile(
  payload: BackendUserProfileResponse,
): InstitutionSettings["account"] {
  return {
    fullName: payload.full_name || "",
    email: payload.email,
    phone: payload.phone,
    currentRole: payload.current_role,
    location: payload.location,
    emailVerifiedAt: payload.email_verified_at,
    phoneVerifiedAt: payload.phone_verified_at,
  };
}

function mapInstitutionNotificationPreferences(
  payload: BackendNotificationPreferenceResponse[],
): InstitutionSettings["notifications"] {
  return payload.map((preference) =>
    mapInstitutionNotificationPreference({
      id: preference.public_id,
      eventType: preference.event_type,
      enabled: preference.enabled,
      preferredChannels: preference.preferred_channels,
    }),
  );
}

function mapInstitutionAccountSessions(
  payload: BackendAccountSessionResponse[],
): InstitutionSettings["sessions"] {
  return payload.map((session) => ({
    id: session.id,
    createdAt: session.created_at,
    expiresAt: session.expires_at,
    lastActiveAt: session.last_active_at,
    current: session.current,
    device: session.device,
    browser: session.browser,
    location: session.location,
  }));
}

function unwrapListResponse<T>(payload: T[] | BackendPageResponse<T>) {
  return Array.isArray(payload) ? payload : payload.items;
}

function mapVerificationRequest(payload: BackendVerificationRequestResponse): VerificationRequest {
  const claim = buildCandidateClaimFromTrustContext({
    trustContext: payload.trust_context,
    candidateName: payload.subject_name,
    institutionName: payload.target_organization_name || undefined,
    requestType: payload.request_type,
    candidateResponse: payload.candidate_response,
    consentedFields: payload.consented_fields,
  });

  return {
    id: payload.public_id,
    reference: getVerificationReference(payload.public_id),
    candidateName: payload.subject_name,
    candidateId: payload.public_id,
    candidateEmail: payload.subject_email,
    requestedBy: getVerificationOriginLabel(payload.origin_type),
    requestPurpose: `${getVerificationRequestTypeLabel(payload.request_type)} verification request`,
    status: payload.status,
    priority: "normal",
    receivedAt: payload.created_at,
    dueAt: payload.due_date || undefined,
    assignedTo: payload.assigned_reviewer?.full_name || payload.assigned_reviewer?.email,
    nextAction: getVerificationNextAction(payload.status),
    consentReceived: Boolean(payload.accepted_at),
    claim,
    institutionRecord: { found: false },
    matchStatus: "record_unavailable",
    evidence: [],
    internalNotes: [],
    timeline: [],
    source: "backend",
    originType: payload.origin_type || undefined,
    requestType: payload.request_type,
    organizationInternalNote: payload.organization_internal_note,
    assignedReviewer: payload.assigned_reviewer
      ? {
          userId: payload.assigned_reviewer.user_id,
          fullName: payload.assigned_reviewer.full_name,
          email: payload.assigned_reviewer.email,
          role: payload.assigned_reviewer.role,
        }
      : null,
    consentedFields: payload.consented_fields,
    consentedEvidenceScope: payload.consented_evidence_scope,
    candidateResponse: payload.candidate_response,
    candidateResponseSubmittedAt: payload.candidate_response_submitted_at,
    trustContext: payload.trust_context,
    evidenceSummary: {
      totalItems: payload.evidence_summary.total_items,
      documentItems: payload.evidence_summary.document_items,
      fieldKeys: payload.evidence_summary.field_keys,
    },
    isAssignedToCurrentUser: payload.is_assigned_to_current_user,
  };
}

function mapInstitutionVerificationFieldMatches(
  fields: BackendInstitutionComparisonFieldResponse[] | undefined,
) {
  return (fields ?? []).reduce<Record<string, "match" | "different">>((accumulator, field) => {
    if (field.outcome === "match" || field.outcome === "different") {
      accumulator[field.key] = field.outcome;
    }
    return accumulator;
  }, {});
}

function mapInstitutionVerificationInboxItem(
  payload: BackendInstitutionVerificationInboxItemResponse,
): VerificationRequest {
  return {
    id: payload.public_id,
    reference: getVerificationReference(payload.public_id),
    candidateName: payload.subject_name,
    candidateId: payload.public_id,
    requestedBy: payload.education_institution_name || "Verification request",
    requestPurpose: `${getVerificationRequestTypeLabel(payload.request_type)} verification request`,
    status: payload.status,
    priority: payload.priority,
    receivedAt: payload.created_at,
    dueAt: payload.due_date || undefined,
    assignedTo: payload.assigned_reviewer_name || undefined,
    nextAction: getVerificationNextAction(payload.status),
    consentReceived: true,
    claim: {
      candidateName: payload.subject_name,
      institutionName: payload.education_institution_name || "—",
      degree: payload.education_degree || "—",
      programme: "—",
      department: "—",
      admissionYear: "—",
      graduationYear: "—",
      completionStatus: `${getVerificationRequestTypeLabel(payload.request_type)} claim submitted`,
    },
    institutionRecord: { found: false },
    matchStatus: "record_unavailable",
    evidence: [],
    internalNotes: [],
    timeline: [],
    source: "backend",
    requestType: payload.request_type,
  };
}

function mapInstitutionVerificationDetail(
  payload: BackendInstitutionVerificationDetailResponse,
): VerificationRequest {
  const fieldMatches = mapInstitutionVerificationFieldMatches(payload.comparison.fields);
  const claim = payload.comparison.candidate_claim;
  const record = payload.comparison.institution_record;

  return {
    id: payload.public_id,
    reference: getVerificationReference(payload.public_id),
    candidateName: payload.subject_name,
    candidateId: payload.public_id,
    requestedBy: claim.institution_name || "Verification request",
    requestPurpose: `${getVerificationRequestTypeLabel(payload.request_type)} verification request`,
    status: payload.status,
    priority: payload.priority,
    receivedAt: payload.created_at,
    dueAt: payload.due_date || undefined,
    assignedTo: payload.assigned_reviewer_name || undefined,
    nextAction: getVerificationNextAction(payload.status),
    consentReceived: true,
    claim: {
      candidateName: payload.subject_name,
      institutionName: claim.institution_name || "—",
      degree: claim.degree || "—",
      programme: claim.programme || "—",
      department: record.department || "—",
      admissionYear: formatInstitutionPeriodValue(claim.admission),
      graduationYear: formatInstitutionPeriodValue(claim.graduation),
      completionStatus: getVerificationRequestTypeLabel(payload.request_type),
      additionalNote:
        payload.candidate_response?.trim() ||
        (payload.consented_fields.length
          ? `Consented fields: ${payload.consented_fields.join(", ")}`
          : undefined),
    },
    institutionRecord: {
      found: record.found,
      studentId: record.student_id || undefined,
      degree: record.degree || undefined,
      programme: record.programme || undefined,
      department: record.department || undefined,
      admissionDate: record.admission.date || record.admission.period || undefined,
      graduationDate: record.graduation.date || record.graduation.period || undefined,
      completionStatus: record.verification_status || undefined,
      credentialIssuanceStatus: record.verification_status || undefined,
    },
    matchStatus: payload.comparison.match_status,
    fieldMatches: Object.keys(fieldMatches).length > 0 ? fieldMatches : undefined,
    evidence: [],
    internalNotes: payload.organization_internal_note?.trim()
      ? [
          {
            id: `${payload.public_id}:internal-note`,
            author: payload.assigned_reviewer_name || "Institution team",
            createdAt: payload.updated_at,
            body: payload.organization_internal_note,
          },
        ]
      : [],
    timeline: [],
    source: "backend",
    requestType: payload.request_type,
    organizationInternalNote: payload.organization_internal_note,
    consentedFields: payload.consented_fields,
    consentedEvidenceScope: payload.consented_evidence_scope,
    candidateResponse: payload.candidate_response,
    candidateResponseSubmittedAt: payload.candidate_response_submitted_at,
  };
}

function mapVerificationEvidence(payload: BackendVerificationEvidenceResponse) {
  return {
    id: payload.public_id,
    name: payload.original_filename || payload.field_key,
    type: payload.document_type || payload.evidence_type,
    uploadedBy: "Request subject",
    uploadedAt: payload.created_at,
    url: payload.download_url || undefined,
  };
}

function mapVerificationTimelineEvent(
  payload: BackendVerificationTimelineEventResponse,
): TimelineEvent {
  const metadataDetail =
    typeof payload.metadata.note === "string"
      ? payload.metadata.note
      : typeof payload.metadata.assignee_email === "string"
        ? payload.metadata.assignee_email
        : Array.isArray(payload.metadata.fields)
          ? payload.metadata.fields.join(", ")
          : undefined;

  return {
    id: payload.public_id,
    at: payload.created_at,
    label: formatVerificationTimelineLabel(payload.event_type),
    detail: metadataDetail,
  };
}

function mapInternalNote(payload: BackendVerificationRequestResponse): InternalNote[] {
  if (!payload.organization_internal_note?.trim()) {
    return [];
  }

  return [
    {
      id: `${payload.public_id}:internal-note`,
      author: payload.assigned_reviewer?.full_name || "Institution team",
      createdAt: payload.updated_at,
      body: payload.organization_internal_note,
    },
  ];
}

function formatInstitutionEventLabel(eventType: string) {
  return eventType
    .replace(/_/g, " ")
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatInstitutionPeriodValue(period: BackendInstitutionPeriodResponse) {
  return period.period || period.date || "—";
}

function mapInstitutionProfessionalProfile(
  items: BackendInstitutionProfessionalFieldValueResponse[],
  consentedFields?: Array<"current_title" | "current_employer">,
) {
  const currentTitle = items.find((item) => item.field === "current_title");
  const currentEmployer = items.find((item) => item.field === "current_employer");

  return {
    consented: (consentedFields?.length ?? items.length) > 0,
    currentTitle: currentTitle?.value,
    currentCompany: currentEmployer?.value,
    fields: items.map((item) => ({
      field: item.field,
      value: item.value,
      consentedAt: item.consented_at,
      expiresAt: item.expires_at,
    })),
    consentedFields: (consentedFields ?? items.map((item) => item.field)).filter(
      (field, index, allFields) => allFields.indexOf(field) === index,
    ),
  } as Person["sharedProfile"];
}

function mapInstitutionDashboard(
  payload: BackendInstitutionDashboardResponse,
): InstitutionDashboard {
  return {
    pendingVerifications: payload.pending_verifications,
    recentlyVerifiedCredentials: payload.recently_verified_credentials.map((credential) => ({
      id: credential.public_id,
      title: credential.title,
      credentialType: credential.credential_type,
      status: credential.status,
      updatedAt: credential.updated_at,
    })),
    verificationActivity: payload.verification_activity.map((item) => ({
      requestId: item.request_public_id,
      eventType: item.event_type,
      eventSource: item.event_source,
      createdAt: item.created_at,
    })),
    people: {
      total: payload.people.total,
      currentStudent: payload.people.current_student,
      alumni: payload.people.alumni,
      withdrawn: payload.people.withdrawn,
      inactive: payload.people.inactive,
    },
    statistics: {
      totalVerifications: payload.statistics.total_verifications,
      verifiedVerifications: payload.statistics.verified_verifications,
      awaitingInformation: payload.statistics.awaiting_information,
      highPriority: payload.statistics.high_priority,
    },
  };
}

function mapInstitutionNotificationCenter(
  payload: BackendPageResponse<BackendUserNotificationResponse>,
  unreadCount: number,
): InstitutionNotificationCenter {
  return {
    items: payload.items.map((item) => ({
      id: item.public_id,
      category: item.category,
      eventType: item.event_type,
      title: item.title,
      body: item.body,
      metadata: item.metadata,
      readAt: item.read_at,
      createdAt: item.created_at,
    })),
    total: payload.total,
    page: payload.page,
    pageSize: payload.page_size,
    totalPages: payload.total_pages,
    offset: payload.offset,
    limit: payload.limit,
    unreadCount,
  };
}

function mapInstitutionCredentialEvent(payload: BackendInstitutionCredentialEventResponse) {
  const statusDetail =
    payload.new_status && payload.previous_status
      ? `${payload.previous_status} -> ${payload.new_status}`
      : payload.new_status || payload.previous_status;

  return {
    at: payload.created_at,
    label: statusDetail
      ? `${formatInstitutionEventLabel(payload.event_type)} · ${statusDetail}`
      : formatInstitutionEventLabel(payload.event_type),
  };
}

function mapInstitutionCredential(
  payload: BackendInstitutionCredentialResponse,
): InstitutionCredential {
  const history = payload.events.map(mapInstitutionCredentialEvent);

  return {
    id: payload.public_id,
    name: payload.title,
    status: payload.status as InstitutionCredential["status"],
    issueDate: payload.issued.date || payload.issued.period || "—",
    issuePeriod: payload.issued.period || undefined,
    lastUpdated: history[0]?.at || payload.issued.date || payload.issued.period || "",
    history,
    credentialType: payload.credential_type,
    degree: payload.degree || undefined,
    programme: payload.programme || undefined,
    department: payload.department || undefined,
    credentialNumber: payload.credential_number,
    version: payload.version,
  };
}

function mapInstitutionVerificationActivity(
  payload: BackendInstitutionVerificationEventResponse,
): Person["verificationActivity"][number] {
  const result =
    payload.new_status && payload.previous_status
      ? `${payload.previous_status} -> ${payload.new_status}`
      : payload.new_status || formatInstitutionEventLabel(payload.event_type);

  return {
    id: payload.public_id,
    requestingOrg: formatInstitutionEventLabel(payload.event_type),
    date: payload.created_at,
    result,
    reviewer: formatInstitutionEventLabel(payload.event_source),
    status: "in_progress",
    requestId: payload.request_public_id,
    eventSource: payload.event_source,
    previousStatus: payload.previous_status,
    newStatus: payload.new_status,
  };
}

function mapInstitutionLifecycleEvents(
  items: BackendInstitutionPersonDetailResponse["lifecycle_events"],
): TimelineEvent[] {
  return items.map((item) => ({
    id: item.public_id,
    at: item.created_at,
    label: item.new_status
      ? `Lifecycle changed to ${formatInstitutionEventLabel(item.new_status)}`
      : "Lifecycle updated",
    detail: item.reason || undefined,
  }));
}

function mapInstitutionPersonListItem(payload: BackendInstitutionPersonListItemResponse): Person {
  const sharedProfile = mapInstitutionProfessionalProfile(payload.professional_information);

  return {
    id: payload.public_id,
    name: payload.display_name,
    institutionStatus: payload.lifecycle_status,
    trustStatus: mapInstitutionVerificationStatus(payload.verification_status),
    degree: payload.degree || "—",
    graduationYear: formatInstitutionPeriodValue(payload.graduation),
    activeVerificationCount: payload.active_verification_count,
    studentIdMasked: payload.student_id_masked || undefined,
    relationship: {
      institutionName: "—",
      studentId: payload.student_id_masked || "—",
      status: payload.lifecycle_status,
      degree: payload.degree || "—",
      programme: payload.programme || "—",
      department: payload.department || "—",
      admissionPeriod: formatInstitutionPeriodValue(payload.admission),
      graduationPeriod: formatInstitutionPeriodValue(payload.graduation),
      verificationStatus: mapInstitutionVerificationStatus(payload.verification_status),
    },
    sharedProfile,
    credentials: [],
    verificationActivity: [],
    timeline: [],
  };
}

function mapInstitutionPersonDetail(payload: BackendInstitutionPersonDetailResponse): Person {
  const sharedProfile = mapInstitutionProfessionalProfile(
    payload.professional_information,
    payload.consented_professional_fields,
  );
  const credentials = payload.credentials.map(mapInstitutionCredential);
  const verificationActivity = payload.verification_history.map(mapInstitutionVerificationActivity);
  const timeline = mapInstitutionLifecycleEvents(payload.lifecycle_events);

  const person: Person = {
    ...mapInstitutionPersonListItem(payload),
    studentIdMasked: payload.student_id_masked || undefined,
    relationship: {
      institutionName: "—",
      studentId: payload.student_id || payload.student_id_masked || "—",
      status: payload.lifecycle_status,
      degree: payload.degree || "—",
      programme: payload.programme || "—",
      department: payload.department || "—",
      admissionPeriod: formatInstitutionPeriodValue(payload.admission),
      graduationPeriod: formatInstitutionPeriodValue(payload.graduation),
      verificationStatus: mapInstitutionVerificationStatus(payload.verification_status),
    },
    sharedProfile,
    credentials,
    verificationActivity,
    timeline,
  };

  return {
    ...person,
    lastUpdated: deriveLastUpdated(person),
  };
}

function mapInstitutionPassportSummary(
  payload: BackendInstitutionPassportSummaryResponse,
): InstitutionPassportSummary {
  return {
    personId: payload.person_public_id,
    displayName: payload.display_name,
    lifecycleStatus: payload.lifecycle_status,
    degree: payload.degree || "—",
    programme: payload.programme || "—",
    department: payload.department || "—",
    admissionPeriod: formatInstitutionPeriodValue(payload.admission),
    graduationPeriod: formatInstitutionPeriodValue(payload.graduation),
    verificationStatus: mapInstitutionVerificationStatus(payload.verification_status),
    consentedProfessionalFields: payload.consented_professional_fields,
    professionalInformation: payload.professional_information.map((item) => ({
      field: item.field,
      value: item.value,
      consentedAt: item.consented_at,
      expiresAt: item.expires_at,
    })),
    credentials: payload.credentials.map((credential) => ({
      id: credential.public_id,
      title: credential.title,
      credentialType: credential.credential_type,
      status: credential.status,
      issuedPeriod: formatInstitutionPeriodValue(credential.issued),
    })),
  };
}

function toStoredTokens(payload: BackendTokenResponse): StoredInstitutionAuthTokens {
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    tokenType: payload.token_type,
    expiresAt: new Date(Date.now() + payload.expires_in * 1000).toISOString(),
  };
}

function mapWorkspaceBootstrap(
  payload: BackendWorkspaceBootstrapResponse,
): InstitutionWorkspaceBootstrap {
  return {
    state: payload.state,
    currentUser: {
      id: payload.current_user.id,
      email: payload.current_user.email,
      fullName: payload.current_user.full_name,
      role: payload.current_user.role,
      activeOrganizationPublicId: payload.current_user.active_organization_public_id,
    },
    activeOrganization: payload.active_organization
      ? {
          publicId: payload.active_organization.public_id,
          name: payload.active_organization.name,
          organizationType: payload.active_organization.organization_type,
          website: payload.active_organization.website,
          location: payload.active_organization.location,
          workEmail: payload.active_organization.work_email,
          domain: payload.active_organization.domain,
          verificationState: payload.active_organization.verification_state,
          setupCompletedAt: payload.active_organization.setup_completed_at,
          suspendedAt: payload.active_organization.suspended_at,
        }
      : null,
    membershipRole: payload.membership_role,
    organizationVerificationState: payload.organization_verification_state,
    organizationSuspended: payload.organization_suspended,
    membershipSuspended: payload.membership_suspended,
    setupCompleted: payload.setup_completed,
    permissionFlags: {
      inviteCandidate: payload.permission_flags.invite_candidate,
      modifyPerson: payload.permission_flags.modify_person,
      modifyInvitation: payload.permission_flags.modify_invitation,
      modifyVerification: payload.permission_flags.modify_verification,
      manageTeam: payload.permission_flags.manage_team,
      saveSettings: payload.permission_flags.save_settings,
      transferOwnership: payload.permission_flags.transfer_ownership,
    },
  };
}

export function getStoredInstitutionAuthTokens() {
  return safeReadAuthTokens();
}

export function storeInstitutionAuthTokens(tokens: StoredInstitutionAuthTokens | null) {
  safeWriteAuthTokens(tokens);
}

async function getValidInstitutionTokens() {
  const stored = getStoredInstitutionAuthTokens();
  if (!stored) {
    throw unauthorizedError();
  }

  if (new Date(stored.expiresAt).getTime() <= Date.now()) {
    return refreshInstitutionUserSession(stored.refreshToken);
  }

  return stored;
}

async function withInstitutionAccessToken<T>(
  execute: (accessToken: string) => Promise<T>,
): Promise<T> {
  let tokens = await getValidInstitutionTokens();

  try {
    return await execute(tokens.accessToken);
  } catch (error) {
    if (!(error instanceof InstitutionError) || error.status !== 401) {
      throw error;
    }

    tokens = await refreshInstitutionUserSession(tokens.refreshToken);
    return execute(tokens.accessToken);
  }
}

export async function loginInstitutionUser(email: string, password: string) {
  const payload = await apiRequest<BackendTokenResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
    invalidCredentials: true,
  });
  const tokens = toStoredTokens(payload);
  storeInstitutionAuthTokens(tokens);
  return tokens;
}

export async function refreshInstitutionUserSession(refreshToken: string) {
  const payload = await apiRequest<BackendTokenResponse>("/api/v1/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const tokens = toStoredTokens(payload);
  storeInstitutionAuthTokens(tokens);
  return tokens;
}

export async function logoutInstitutionUser(refreshToken: string) {
  await apiRequest<void>("/api/v1/auth/logout", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}

export async function requestInstitutionPasswordReset(email: string) {
  await apiRequest<{ message: string }>("/api/v1/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
    unauthorizedUiMessage:
      "Password reset is not available for this account right now. Please try again later.",
  });
}

export async function completeInstitutionPasswordReset(token: string, password: string) {
  await apiRequest<{ message: string }>("/api/v1/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({
      token,
      new_password: password,
      confirm_password: password,
    }),
    unauthorizedUiMessage: "This password reset link is invalid or has expired.",
  });
}

export async function getInstitutionWorkspaceBootstrap(accessToken: string) {
  const payload = await apiRequest<BackendWorkspaceBootstrapResponse>(
    "/api/v1/workspace/bootstrap",
    {
      method: "GET",
    },
    accessToken,
  );
  return mapWorkspaceBootstrap(payload);
}

export async function getInstitutionOrganization(orgPublicId: string) {
  return withInstitutionAccessToken(async (accessToken) => {
    const payload = await apiRequest<BackendOrganizationResponse>(
      `/api/v1/organizations/${orgPublicId}`,
      { method: "GET" },
      accessToken,
    );

    return mapInstitutionOrganization(payload);
  });
}

export async function updateInstitutionOrganization(
  orgPublicId: string,
  payload: {
    name?: string;
    website?: string | null;
    location?: string | null;
    workEmail?: string | null;
    domain?: string | null;
  },
) {
  return withInstitutionAccessToken(async (accessToken) => {
    const response = await apiRequest<BackendOrganizationResponse>(
      `/api/v1/organizations/${orgPublicId}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          name: payload.name,
          website: payload.website,
          location: payload.location,
          work_email: payload.workEmail,
          domain: payload.domain,
        }),
      },
      accessToken,
    );

    return mapInstitutionOrganization(response);
  });
}

export async function getInstitutionAccountSettings() {
  return withInstitutionAccessToken(async (accessToken) => {
    const payload = await apiRequest<BackendAccountSettingsResponse>(
      "/api/v1/account/settings",
      { method: "GET" },
      accessToken,
    );

    return {
      account: mapInstitutionAccountProfile(payload.profile),
      notifications: mapInstitutionNotificationPreferences(payload.notification_preferences),
    };
  });
}

export async function updateInstitutionAccountNotificationPreferences(
  preferences: {
    event_type: string;
    enabled: boolean;
    preferred_channels: string[];
    quiet_hours?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }[],
) {
  return withInstitutionAccessToken(async (accessToken) => {
    const payload = await apiRequest<BackendAccountSettingsResponse>(
      "/api/v1/account/settings",
      {
        method: "PATCH",
        body: JSON.stringify({
          notification_preferences: preferences,
        }),
      },
      accessToken,
    );

    return mapInstitutionNotificationPreferences(payload.notification_preferences);
  });
}

export async function updateInstitutionCurrentUserProfile(payload: {
  fullName?: string | null;
  phone?: string | null;
  currentRole?: string | null;
  location?: string | null;
}) {
  return withInstitutionAccessToken(async (accessToken) => {
    const response = await apiRequest<BackendUserProfileResponse>(
      "/api/v1/users/me",
      {
        method: "PATCH",
        body: JSON.stringify({
          full_name: payload.fullName,
          phone: payload.phone,
          current_role: payload.currentRole,
          location: payload.location,
        }),
      },
      accessToken,
    );

    return mapInstitutionAccountProfile(response);
  });
}

export async function getInstitutionAccountSessions() {
  return withInstitutionAccessToken(async (accessToken) => {
    const payload = await apiRequest<BackendAccountSessionResponse[]>(
      "/api/v1/account/sessions",
      { method: "GET" },
      accessToken,
    );

    return mapInstitutionAccountSessions(payload);
  });
}

export async function revokeInstitutionAccountSession(sessionId: string) {
  return withInstitutionAccessToken(async (accessToken) => {
    await apiRequest<void>(
      `/api/v1/account/sessions/${sessionId}`,
      { method: "DELETE" },
      accessToken,
    );
  });
}

export async function revokeAllInstitutionAccountSessions() {
  return withInstitutionAccessToken(async (accessToken) => {
    await apiRequest<void>("/api/v1/account/sessions", { method: "DELETE" }, accessToken);
  });
}

export async function changeInstitutionPassword(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}) {
  return withInstitutionAccessToken(async (accessToken) => {
    await apiRequest<void>(
      "/api/v1/auth/change-password",
      {
        method: "POST",
        body: JSON.stringify({
          current_password: input.currentPassword,
          new_password: input.newPassword,
          confirm_password: input.confirmPassword,
        }),
      },
      accessToken,
    );
  });
}

export async function startOrganizationStaffSignup(input: {
  fullName: string;
  workEmail: string;
  password: string;
}) {
  const payload = await apiRequest<{
    signup_session_id: string;
    email_masked: string;
    email_verified: boolean;
    email_resend_after_seconds: number;
    expires_in_seconds: number;
    message: string;
  }>("/api/v1/auth/organization/signup/start", {
    method: "POST",
    body: JSON.stringify({
      full_name: input.fullName,
      work_email: input.workEmail,
      password: input.password,
    }),
  });

  return {
    signupSessionId: payload.signup_session_id,
    emailMasked: payload.email_masked,
    emailVerified: payload.email_verified,
    resendAfterSeconds: payload.email_resend_after_seconds,
    expiresInSeconds: payload.expires_in_seconds,
    message: payload.message,
  } satisfies OrganizationSignupStartResult;
}

export async function sendOrganizationStaffSignupEmail(signupSessionId: string) {
  const payload = await apiRequest<{
    signup_session_id: string;
    email_masked: string;
    email_verified: boolean;
    resend_after_seconds: number;
    expires_in_seconds: number;
    message: string;
  }>("/api/v1/auth/organization/signup/email/send", {
    method: "POST",
    body: JSON.stringify({ signup_session_id: signupSessionId }),
  });

  return {
    signupSessionId: payload.signup_session_id,
    emailMasked: payload.email_masked,
    emailVerified: payload.email_verified,
    resendAfterSeconds: payload.resend_after_seconds,
    expiresInSeconds: payload.expires_in_seconds,
    message: payload.message,
  } satisfies OrganizationSignupEmailSendResult;
}

export async function verifyOrganizationStaffSignupEmail(signupSessionId: string, code: string) {
  const payload = await apiRequest<{
    signup_session_id: string;
    email_verified: boolean;
    message: string;
  }>("/api/v1/auth/organization/signup/email/verify", {
    method: "POST",
    body: JSON.stringify({
      signup_session_id: signupSessionId,
      code,
    }),
    unauthorizedUiMessage: "Invalid or expired verification code.",
  });

  return {
    signupSessionId: payload.signup_session_id,
    emailVerified: payload.email_verified,
    message: payload.message,
  } satisfies OrganizationSignupEmailVerifyResult;
}

export async function completeOrganizationStaffSignup(signupSessionId: string) {
  const payload = await apiRequest<BackendTokenResponse>(
    "/api/v1/auth/organization/signup/complete",
    {
      method: "POST",
      body: JSON.stringify({ signup_session_id: signupSessionId }),
      unauthorizedUiMessage: "Email verification is required before signup can be completed.",
    },
  );

  const tokens = toStoredTokens(payload);
  storeInstitutionAuthTokens(tokens);
  return tokens;
}

export async function completeInstitutionWorkspaceOnboarding(
  accessToken: string,
  payload: InstitutionOnboardingPayload,
) {
  const response = await apiRequest<BackendOrganizationResponse>(
    "/api/v1/organizations/onboarding/complete",
    {
      method: "POST",
      body: JSON.stringify({
        name: payload.name,
        organization_type: "university",
        website: payload.website || null,
        location: payload.location || null,
        work_email: payload.workEmail || null,
        domain: payload.domain || null,
      }),
    },
    accessToken,
  );

  return {
    publicId: response.public_id,
    name: response.name,
  };
}

export async function getInstitutionOrganizationTeam(
  orgPublicId: string,
): Promise<InstitutionTeam> {
  return withInstitutionAccessToken(async (accessToken) => {
    const [members, invitations] = await Promise.all([
      apiRequest<BackendOrganizationMemberResponse[]>(
        `/api/v1/organizations/${orgPublicId}/members`,
        { method: "GET" },
        accessToken,
      ),
      apiRequest<BackendOrganizationInvitationResponse[]>(
        `/api/v1/organizations/${orgPublicId}/invitations`,
        { method: "GET" },
        accessToken,
      ),
    ]);

    return {
      members: members.map(mapOrganizationMember),
      invitations: invitations.map(mapOrganizationInvitation),
    };
  });
}

export async function createInstitutionOrganizationInvitation(
  orgPublicId: string,
  input: CreateOrganizationInvitationInput,
) {
  return withInstitutionAccessToken(async (accessToken) => {
    const payload = await apiRequest<BackendOrganizationInvitationResponse>(
      `/api/v1/organizations/${orgPublicId}/invitations`,
      {
        method: "POST",
        body: JSON.stringify({
          invitee_email: input.inviteeEmail,
          role: input.role,
        }),
      },
      accessToken,
    );

    return mapOrganizationInvitation(payload);
  });
}

export async function resendInstitutionOrganizationInvitation(
  orgPublicId: string,
  invitationPublicId: string,
) {
  return withInstitutionAccessToken(async (accessToken) => {
    const payload = await apiRequest<BackendOrganizationInvitationResponse>(
      `/api/v1/organizations/${orgPublicId}/invitations/${invitationPublicId}/resend`,
      {
        method: "POST",
      },
      accessToken,
    );

    return mapOrganizationInvitation(payload);
  });
}

export async function cancelInstitutionOrganizationInvitation(
  orgPublicId: string,
  invitationPublicId: string,
) {
  return withInstitutionAccessToken(async (accessToken) => {
    const payload = await apiRequest<BackendOrganizationInvitationResponse>(
      `/api/v1/organizations/${orgPublicId}/invitations/${invitationPublicId}/cancel`,
      {
        method: "POST",
      },
      accessToken,
    );

    return mapOrganizationInvitation(payload);
  });
}

export async function updateInstitutionOrganizationMemberRole(
  orgPublicId: string,
  memberPublicId: string,
  input: UpdateOrganizationMemberRoleInput,
) {
  return withInstitutionAccessToken(async (accessToken) => {
    const payload = await apiRequest<BackendOrganizationMemberResponse>(
      `/api/v1/organizations/${orgPublicId}/members/${memberPublicId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ role: input.role }),
      },
      accessToken,
    );

    return mapOrganizationMember(payload);
  });
}

export async function suspendInstitutionOrganizationMember(
  orgPublicId: string,
  memberPublicId: string,
  input: SuspendOrganizationMemberInput = {},
) {
  return withInstitutionAccessToken(async (accessToken) => {
    const payload = await apiRequest<BackendOrganizationMemberResponse>(
      `/api/v1/organizations/${orgPublicId}/members/${memberPublicId}/suspend`,
      {
        method: "POST",
        body: JSON.stringify({
          reason: input.reason?.trim() || null,
        }),
      },
      accessToken,
    );

    return mapOrganizationMember(payload);
  });
}

export async function restoreInstitutionOrganizationMember(
  orgPublicId: string,
  memberPublicId: string,
) {
  return withInstitutionAccessToken(async (accessToken) => {
    const payload = await apiRequest<BackendOrganizationMemberResponse>(
      `/api/v1/organizations/${orgPublicId}/members/${memberPublicId}/restore`,
      {
        method: "POST",
      },
      accessToken,
    );

    return mapOrganizationMember(payload);
  });
}

export async function removeInstitutionOrganizationMember(
  orgPublicId: string,
  memberPublicId: string,
) {
  return withInstitutionAccessToken(async (accessToken) => {
    await apiRequest<void>(
      `/api/v1/organizations/${orgPublicId}/members/${memberPublicId}`,
      {
        method: "DELETE",
      },
      accessToken,
    );
  });
}

export async function transferInstitutionOrganizationOwnership(
  orgPublicId: string,
  memberPublicId: string,
) {
  return withInstitutionAccessToken(async (accessToken) => {
    await apiRequest<void>(
      `/api/v1/organizations/${orgPublicId}/members/${memberPublicId}/transfer-ownership`,
      {
        method: "POST",
      },
      accessToken,
    );
  });
}

export async function getInstitutionOrganizationPeople(
  orgPublicId: string,
  input: InstitutionPeopleQueryInput = {},
) {
  return withInstitutionAccessToken(async (accessToken) => {
    const query = buildQueryString({
      search: input.search?.trim() || undefined,
      lifecycle_status:
        input.lifecycleStatus && input.lifecycleStatus !== "all"
          ? input.lifecycleStatus
          : undefined,
      programme: input.programme?.trim() || undefined,
      department: input.department?.trim() || undefined,
      graduation_period: input.graduationPeriod?.trim() || undefined,
      student_id: input.studentId?.trim() || undefined,
      verification_status:
        input.verificationStatus && input.verificationStatus !== "all"
          ? input.verificationStatus
          : undefined,
      page_size: input.pageSize ?? 100,
    });
    const payload = await apiRequest<BackendPageResponse<BackendInstitutionPersonListItemResponse>>(
      `/api/v1/organizations/${orgPublicId}/institution/people${query}`,
      {
        method: "GET",
      },
      accessToken,
    );

    return {
      items: payload.items.map(mapInstitutionPersonListItem),
      total: payload.total,
    };
  });
}

export async function getInstitutionOrganizationPerson(
  orgPublicId: string,
  personPublicId: string,
) {
  return withInstitutionAccessToken(async (accessToken) => {
    const payload = await apiRequest<BackendInstitutionPersonDetailResponse>(
      `/api/v1/organizations/${orgPublicId}/institution/people/${personPublicId}`,
      {
        method: "GET",
      },
      accessToken,
    );

    return mapInstitutionPersonDetail(payload);
  });
}

export async function getInstitutionOrganizationPersonVerificationHistory(
  orgPublicId: string,
  personPublicId: string,
) {
  return withInstitutionAccessToken(async (accessToken) => {
    const payload = await apiRequest<BackendInstitutionVerificationEventResponse[]>(
      `/api/v1/organizations/${orgPublicId}/institution/people/${personPublicId}/verification-history`,
      {
        method: "GET",
      },
      accessToken,
    );

    return payload.map(mapInstitutionVerificationActivity);
  });
}

export async function getInstitutionOrganizationPersonCredentials(
  orgPublicId: string,
  personPublicId: string,
) {
  return withInstitutionAccessToken(async (accessToken) => {
    const payload = await apiRequest<BackendInstitutionCredentialResponse[]>(
      `/api/v1/organizations/${orgPublicId}/institution/people/${personPublicId}/credentials`,
      {
        method: "GET",
      },
      accessToken,
    );

    return payload.map(mapInstitutionCredential);
  });
}

export async function getInstitutionOrganizationPersonPassportSummary(
  orgPublicId: string,
  personPublicId: string,
) {
  return withInstitutionAccessToken(async (accessToken) => {
    const payload = await apiRequest<BackendInstitutionPassportSummaryResponse>(
      `/api/v1/organizations/${orgPublicId}/institution/people/${personPublicId}/passport-summary`,
      {
        method: "GET",
      },
      accessToken,
    );

    return mapInstitutionPassportSummary(payload);
  });
}

export async function getInstitutionDashboard(orgPublicId: string) {
  return withInstitutionAccessToken(async (accessToken) => {
    const payload = await apiRequest<BackendInstitutionDashboardResponse>(
      `/api/v1/organizations/${orgPublicId}/institution/dashboard`,
      {
        method: "GET",
      },
      accessToken,
    );

    return mapInstitutionDashboard(payload);
  });
}

export async function getInstitutionNotificationCenter() {
  return withInstitutionAccessToken(async (accessToken) => {
    const [notifications, unread] = await Promise.all([
      apiRequest<BackendPageResponse<BackendUserNotificationResponse>>(
        "/api/v1/notifications?paginate=true&page=1&page_size=10&sort_order=desc",
        { method: "GET" },
        accessToken,
      ),
      apiRequest<BackendNotificationUnreadCountResponse>(
        "/api/v1/notifications/unread-count",
        { method: "GET" },
        accessToken,
      ),
    ]);

    return mapInstitutionNotificationCenter(notifications, unread.unread_count);
  });
}

export async function markInstitutionNotificationRead(notificationPublicId: string) {
  return withInstitutionAccessToken(async (accessToken) => {
    await apiRequest<void>(
      `/api/v1/notifications/${notificationPublicId}/read`,
      { method: "POST" },
      accessToken,
    );
  });
}

export async function markAllInstitutionNotificationsRead() {
  return withInstitutionAccessToken(async (accessToken) => {
    await apiRequest<void>("/api/v1/notifications/read-all", { method: "POST" }, accessToken);
  });
}

export async function getInstitutionOrganizationVerificationRequests(
  orgPublicId: string,
  input: InstitutionVerificationInboxQueryInput = {},
): Promise<InstitutionVerificationInbox> {
  return withInstitutionAccessToken(async (accessToken) => {
    const query = buildQueryString({
      search: input.search?.trim() || undefined,
      status: input.status && input.status !== "all" ? input.status : undefined,
      priority: input.priority && input.priority !== "all" ? input.priority : undefined,
      request_type:
        input.requestType && input.requestType !== "all" ? input.requestType : undefined,
      assigned_to_me: input.assignedToMe || undefined,
      sort_by: input.sortBy || "created_at",
      sort_order: input.sortOrder || "desc",
      page: input.page || 1,
      page_size: input.pageSize || 25,
    });
    const payload = await apiRequest<BackendInstitutionVerificationInboxResponse>(
      `/api/v1/organizations/${orgPublicId}/institution/verification-requests${query}`,
      {
        method: "GET",
      },
      accessToken,
    );

    return {
      items: payload.items.map(mapInstitutionVerificationInboxItem),
      total: payload.total,
      page: payload.page,
      pageSize: payload.page_size,
      totalPages: payload.total_pages,
      offset: payload.offset,
      limit: payload.limit,
    };
  });
}

export async function getInstitutionVerificationRequestDetail(
  orgPublicId: string,
  requestPublicId: string,
) {
  return withInstitutionAccessToken(async (accessToken) => {
    const payload = await apiRequest<BackendInstitutionVerificationDetailResponse>(
      `/api/v1/organizations/${orgPublicId}/institution/verification-requests/${requestPublicId}`,
      {
        method: "GET",
      },
      accessToken,
    );

    return mapInstitutionVerificationDetail(payload);
  });
}

export async function cancelInstitutionVerificationRequest(
  orgPublicId: string,
  requestPublicId: string,
  input: VerificationRequestActionInput,
) {
  return withInstitutionAccessToken(async (accessToken) => {
    const payload = await apiRequest<BackendInstitutionVerificationDetailResponse>(
      `/api/v1/organizations/${orgPublicId}/institution/verification-requests/${requestPublicId}/cancel`,
      {
        method: "POST",
        body: JSON.stringify({
          note: input.note?.trim() || null,
          metadata: input.metadata || {},
        }),
      },
      accessToken,
    );

    return mapInstitutionVerificationDetail(payload);
  });
}

export async function updateInstitutionVerificationPriority(
  orgPublicId: string,
  requestPublicId: string,
  priority: VerificationPriority,
) {
  return withInstitutionAccessToken(async (accessToken) => {
    const payload = await apiRequest<BackendInstitutionVerificationDetailResponse>(
      `/api/v1/organizations/${orgPublicId}/institution/verification-requests/${requestPublicId}/priority`,
      {
        method: "PATCH",
        body: JSON.stringify({ priority }),
      },
      accessToken,
    );

    return mapInstitutionVerificationDetail(payload);
  });
}

export async function getInstitutionVerificationEvidence(requestPublicId: string) {
  return withInstitutionAccessToken(async (accessToken) => {
    const payload = await apiRequest<
      | BackendVerificationEvidenceResponse[]
      | BackendPageResponse<BackendVerificationEvidenceResponse>
    >(
      `/api/v1/verification-requests/${requestPublicId}/evidence`,
      {
        method: "GET",
      },
      accessToken,
    );

    return unwrapListResponse(payload).map(mapVerificationEvidence);
  });
}

export async function getInstitutionVerificationTimeline(requestPublicId: string) {
  return withInstitutionAccessToken(async (accessToken) => {
    const payload = await apiRequest<BackendVerificationTimelineResponse>(
      `/api/v1/verification-requests/${requestPublicId}/timeline`,
      {
        method: "GET",
      },
      accessToken,
    );

    return payload.items.map(mapVerificationTimelineEvent);
  });
}

export async function assignInstitutionVerificationReviewer(
  requestPublicId: string,
  input: AssignVerificationReviewerInput,
) {
  return withInstitutionAccessToken(async (accessToken) => {
    const payload = await apiRequest<BackendVerificationRequestResponse>(
      `/api/v1/verification-requests/${requestPublicId}/reviewer`,
      {
        method: "PUT",
        body: JSON.stringify({
          organization_member_public_id: input.organizationMemberPublicId || null,
        }),
      },
      accessToken,
    );

    return mapVerificationRequest(payload);
  });
}

export async function updateInstitutionVerificationInternalNote(
  requestPublicId: string,
  note: string,
) {
  return withInstitutionAccessToken(async (accessToken) => {
    const payload = await apiRequest<BackendVerificationRequestResponse>(
      `/api/v1/verification-requests/${requestPublicId}/internal-note`,
      {
        method: "PUT",
        body: JSON.stringify({
          note: note.trim() || null,
        }),
      },
      accessToken,
    );

    return {
      ...mapVerificationRequest(payload),
      internalNotes: mapInternalNote(payload),
    };
  });
}

export async function requestInstitutionVerificationInformation(
  requestPublicId: string,
  input: VerificationRequestActionInput,
) {
  return withInstitutionAccessToken(async (accessToken) => {
    const payload = await apiRequest<BackendVerificationRequestResponse>(
      `/api/v1/verification-requests/${requestPublicId}/request-information`,
      {
        method: "POST",
        body: JSON.stringify({
          note: input.note?.trim() || null,
          metadata: input.metadata || {},
        }),
      },
      accessToken,
    );

    return mapVerificationRequest(payload);
  });
}

export async function verifyInstitutionVerificationRequest(
  requestPublicId: string,
  input: VerificationRequestActionInput,
) {
  return withInstitutionAccessToken(async (accessToken) => {
    const payload = await apiRequest<BackendVerificationRequestResponse>(
      `/api/v1/verification-requests/${requestPublicId}/verify`,
      {
        method: "POST",
        body: JSON.stringify({
          note: input.note?.trim() || null,
          metadata: input.metadata || {},
        }),
      },
      accessToken,
    );

    return mapVerificationRequest(payload);
  });
}

export async function rejectInstitutionVerificationRequest(
  requestPublicId: string,
  input: VerificationRequestActionInput,
) {
  return withInstitutionAccessToken(async (accessToken) => {
    const payload = await apiRequest<BackendVerificationRequestResponse>(
      `/api/v1/verification-requests/${requestPublicId}/reject`,
      {
        method: "POST",
        body: JSON.stringify({
          note: input.note?.trim() || null,
          metadata: input.metadata || {},
        }),
      },
      accessToken,
    );

    return mapVerificationRequest(payload);
  });
}
