// Institution Workspace typed models.
// BACKEND-INTEGRATION: these mirror the shapes we expect Kairo's backend to return.

export type VerificationStatus =
  | "pending"
  | "in_progress"
  | "awaiting_clarification"
  | "confirmed"
  | "discrepancy"
  | "closed"
  | "draft"
  | "pending_subject_acceptance"
  | "accepted"
  | "pending_subject_submission"
  | "pending_admin_review"
  | "awaiting_subject_corrections"
  | "pending_admin_re_review"
  | "approved_for_organization_verification"
  | "pending_organization_resolution"
  | "pending_organization_acceptance"
  | "awaiting_information"
  | "verified"
  | "rejected"
  | "cancelled"
  | "expired";

export type VerificationRequestType =
  | "employment"
  | "education"
  | "identity"
  | "document"
  | "license"
  | "medical"
  | "reference"
  | "platform"
  | "certification"
  | "custom";

export type VerificationOriginType =
  | "trust_invitation"
  | "subject_initiated"
  | "organization_created"
  | "admin_created"
  | "api"
  | "system";

export type MatchStatus = "exact" | "partial" | "no_match" | "record_unavailable";
export type VerificationPriority = "low" | "normal" | "high" | "urgent";

export type InstitutionStatus = "current_student" | "alumni" | "withdrawn" | "inactive";

export type TrustStatus =
  | "institution_verified"
  | "pending"
  | "disputed"
  | "revoked"
  | "not_started"
  | "verified"
  | "discrepancy"
  | "clarification_required"
  | "rejected"
  | "expired";

export type PassportStatus = "connected" | "not_connected" | "sharing_limited";

export type ProfessionalField = "current_title" | "current_employer";

export type InstitutionCredentialStatus =
  | "verified"
  | "pending"
  | "corrected"
  | "revoked"
  | "issued"
  | "superseded";

export type Role = "owner" | "admin" | "reviewer" | "member";

export type AccountStatus = "active" | "invited" | "pending_review" | "suspended";

export type InstitutionWorkspaceStatus = "pending_review" | "active" | "suspended" | "inactive";

export type WorkspaceAccessState =
  | "ready"
  | "no_org"
  | "invitation_pending"
  | "setup_incomplete"
  | "verification_pending"
  | "org_suspended"
  | "membership_suspended";

export type OrganizationVerificationState =
  | "setup_incomplete"
  | "verification_pending"
  | "verified"
  | "additional_information_required";

export interface CandidateClaim {
  candidateName: string;
  studentId?: string;
  institutionName: string;
  degree: string;
  programme: string;
  department: string;
  admissionYear: string;
  graduationYear: string;
  completionStatus: string;
  additionalNote?: string;
}

export interface InstitutionRecord {
  found: boolean;
  studentId?: string;
  officialName?: string;
  degree?: string;
  programme?: string;
  department?: string;
  admissionDate?: string;
  graduationDate?: string;
  completionStatus?: string;
  credentialIssuanceStatus?: string;
}

export interface EvidenceFile {
  id: string;
  name: string;
  type: string;
  uploadedBy: string;
  uploadedAt: string;
  url?: string;
}

export interface InternalNote {
  id: string;
  author: string;
  createdAt: string;
  body: string;
}

export interface TimelineEvent {
  id: string;
  at: string;
  label: string;
  detail?: string;
}

export interface VerificationReviewer {
  userId: string;
  fullName?: string | null;
  email: string;
  role: string;
}

export interface VerificationEvidenceSummary {
  totalItems: number;
  documentItems: number;
  fieldKeys: string[];
}

export interface VerificationRequest {
  id: string;
  reference: string;
  candidateName: string;
  candidateId: string;
  candidateEmail?: string;
  requestedBy: string;
  requestPurpose: string;
  requestingContact?: string;
  status: VerificationStatus;
  priority?: VerificationPriority;
  receivedAt: string;
  dueAt?: string;
  assignedTo?: string;
  nextAction?: string;
  consentReceived: boolean;
  claim: CandidateClaim;
  institutionRecord: InstitutionRecord;
  matchStatus: MatchStatus;
  fieldMatches?: Record<string, "match" | "different">;
  evidence: EvidenceFile[];
  internalNotes: InternalNote[];
  timeline: TimelineEvent[];
  source?: "demo" | "backend";
  originType?: VerificationOriginType;
  requestType?: VerificationRequestType;
  organizationInternalNote?: string | null;
  assignedReviewer?: VerificationReviewer | null;
  consentedFields?: string[];
  consentedEvidenceScope?: string[];
  candidateResponse?: string | null;
  candidateResponseSubmittedAt?: string | null;
  trustContext?: Record<string, unknown>;
  evidenceSummary?: VerificationEvidenceSummary;
  isAssignedToCurrentUser?: boolean | null;
}

export interface InstitutionVerificationInbox {
  items: VerificationRequest[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  offset: number;
  limit: number;
}

export interface InstitutionVerificationInboxFilters {
  search?: string;
  status?: VerificationStatus | "all";
  priority?: VerificationPriority | "all";
  requestType?: VerificationRequestType | "all";
  assignedToMe?: boolean;
  sortBy?: "created_at" | "updated_at" | "due_date" | "priority" | "status";
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface SharedProfessionalProfile {
  consented: boolean;
  currentTitle?: string;
  currentCompany?: string;
  industry?: string;
  location?: string;
  credentials?: { name: string; verifiedAt: string }[];
  lastUpdated?: string;
  fields?: {
    field: ProfessionalField;
    value: string;
    consentedAt: string;
    expiresAt?: string | null;
  }[];
  consentedFields?: ProfessionalField[];
}

export interface InstitutionCredential {
  id: string;
  name: string;
  status: InstitutionCredentialStatus;
  issueDate: string;
  lastUpdated: string;
  history: { at: string; label: string }[];
  revokedReason?: string;
  credentialType?: string;
  degree?: string;
  programme?: string;
  department?: string;
  issuePeriod?: string;
  credentialNumber?: string | null;
  version?: number;
}

export interface InstitutionRelationship {
  institutionName: string;
  studentId: string;
  status: InstitutionStatus;
  degree: string;
  programme: string;
  department: string;
  admissionPeriod: string;
  graduationPeriod: string;
  verificationStatus: TrustStatus;
}

export interface Person {
  id: string;
  name: string;
  institutionStatus: InstitutionStatus;
  trustStatus: TrustStatus;
  passportStatus?: PassportStatus;
  degree: string;
  graduationYear: string;
  activeVerificationCount?: number;
  studentIdMasked?: string;
  relationship: InstitutionRelationship;
  sharedProfile: SharedProfessionalProfile;
  credentials: InstitutionCredential[];
  verificationActivity: {
    id: string;
    requestingOrg: string;
    date: string;
    result: string;
    reviewer: string;
    status: VerificationStatus;
    requestId?: string;
    eventSource?: string;
    previousStatus?: string | null;
    newStatus?: string | null;
  }[];
  timeline: TimelineEvent[];
  lastUpdated?: string;
}

export interface InstitutionPeopleDirectory {
  items: Person[];
  total: number;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: "active" | "pending" | "suspended";
  lastActive?: string;
  suspendedReason?: string | null;
}

export type TeamInvitationStatus = "pending" | "accepted" | "declined" | "cancelled" | "expired";

export interface TeamInvitation {
  id: string;
  email: string;
  role: Exclude<Role, "owner">;
  status: TeamInvitationStatus;
  invitedByEmail?: string | null;
  invitedByName?: string | null;
  invitedAt: string;
  expiresAt?: string | null;
  acceptedAt?: string | null;
  declinedAt?: string | null;
  cancelledAt?: string | null;
}

export interface InstitutionTeam {
  members: TeamMember[];
  invitations: TeamInvitation[];
}

export interface Institution {
  id: string;
  name: string;
  type: string;
  website: string;
  address: string;
  primaryVerificationEmail: string;
  domain: string;
  logoUrl?: string;
  location?: string | null;
  workEmail?: string | null;
  industry?: string | null;
  verificationState?: OrganizationVerificationState | null;
  domainVerifiedAt?: string | null;
  suspendedAt?: string | null;
}

export interface InstitutionAccountPreferences {
  fullName: string;
  email: string;
  phone?: string | null;
  currentRole?: string | null;
  location?: string | null;
  emailVerifiedAt?: string | null;
  phoneVerifiedAt?: string | null;
}

export interface InstitutionNotificationPreference {
  id: string;
  eventType: string;
  label: string;
  description: string;
  enabled: boolean;
  preferredChannels: string[];
  required: boolean;
}

export interface InstitutionNotification {
  id: string;
  category: string;
  eventType: string;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  readAt?: string | null;
  createdAt: string;
}

export interface InstitutionNotificationCenter {
  items: InstitutionNotification[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  offset: number;
  limit: number;
  unreadCount: number;
}

export interface InstitutionAccountSession {
  id: string;
  createdAt: string;
  expiresAt: string;
  lastActiveAt: string;
  current: boolean;
  device?: string | null;
  browser?: string | null;
  location?: string | null;
}

export interface InstitutionSettings {
  institution: Institution;
  account: InstitutionAccountPreferences;
  notifications: InstitutionNotificationPreference[];
  sessions: InstitutionAccountSession[];
  security: {
    domainVerified: boolean;
    domainVerifiedAt?: string | null;
    canChangePassword: boolean;
  };
  workspace: {
    verificationPreferencesAvailable: boolean;
    integrationConnectionsAvailable: boolean;
    sessionDeviceDetailsAvailable: boolean;
    mfaAvailable: boolean;
    securityHistoryAvailable: boolean;
  };
}

export interface InstitutionDashboardCredential {
  id: string;
  title: string;
  credentialType: string;
  status: InstitutionCredentialStatus;
  updatedAt: string;
}

export interface InstitutionDashboardActivity {
  requestId: string;
  eventType: string;
  eventSource: string;
  createdAt: string;
}

export interface InstitutionPeopleSummary {
  total: number;
  currentStudent: number;
  alumni: number;
  withdrawn: number;
  inactive: number;
}

export interface InstitutionDashboardStatistics {
  totalVerifications: number;
  verifiedVerifications: number;
  awaitingInformation: number;
  highPriority: number;
}

export interface InstitutionDashboard {
  pendingVerifications: number;
  recentlyVerifiedCredentials: InstitutionDashboardCredential[];
  verificationActivity: InstitutionDashboardActivity[];
  people: InstitutionPeopleSummary;
  statistics: InstitutionDashboardStatistics;
}

export interface InstitutionPassportSummary {
  personId: string;
  displayName: string;
  lifecycleStatus: InstitutionStatus;
  degree: string;
  programme: string;
  department: string;
  admissionPeriod: string;
  graduationPeriod: string;
  verificationStatus: TrustStatus;
  consentedProfessionalFields: ProfessionalField[];
  professionalInformation: Array<{
    field: ProfessionalField;
    value: string;
    consentedAt: string;
    expiresAt?: string | null;
  }>;
  credentials: Array<{
    id: string;
    title: string;
    credentialType: string;
    status: InstitutionCredentialStatus | string;
    issuedPeriod: string;
  }>;
}

export interface MagicLinkRequest {
  token: string;
  state: "valid" | "expired" | "completed" | "revoked" | "invalid";
  expiresAt?: string;
  request?: {
    reference: string;
    requestedBy: string;
    purpose: string;
    requestDate: string;
    consentReceived: boolean;
    candidate: CandidateClaim;
    evidence: EvidenceFile[];
  };
}

export interface InstitutionPermissionFlags {
  inviteCandidate: boolean;
  modifyPerson: boolean;
  modifyInvitation: boolean;
  modifyVerification: boolean;
  manageTeam: boolean;
  saveSettings: boolean;
  transferOwnership: boolean;
}

export interface InstitutionWorkspaceBootstrap {
  state: WorkspaceAccessState;
  currentUser: {
    id: string;
    email: string;
    fullName: string | null;
    role: string;
    activeOrganizationPublicId: string | null;
  };
  activeOrganization: {
    publicId: string;
    name: string;
    organizationType: string;
    website: string | null;
    location: string | null;
    workEmail: string | null;
    domain: string | null;
    verificationState: OrganizationVerificationState | null;
    setupCompletedAt: string | null;
    suspendedAt: string | null;
  } | null;
  membershipRole: Role | null;
  organizationVerificationState: OrganizationVerificationState | null;
  organizationSuspended: boolean;
  membershipSuspended: boolean;
  setupCompleted: boolean;
  permissionFlags: InstitutionPermissionFlags;
}

export interface Session {
  userId: string;
  membershipId?: string;
  institutionId: string;
  name: string;
  email: string;
  role: Role;
  institutionName: string;
  accountStatus: AccountStatus;
  workspaceStatus: InstitutionWorkspaceStatus;
  expiresAt?: string;
  permissionFlags?: InstitutionPermissionFlags;
  workspaceAccessState?: WorkspaceAccessState;
  organizationVerificationState?: OrganizationVerificationState | null;
}
