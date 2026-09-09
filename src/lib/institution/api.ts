import { institutionAppConfig } from "./config";
import {
  assignInstitutionVerificationReviewer,
  cancelInstitutionVerificationRequest,
  cancelInstitutionOrganizationInvitation,
  changeInstitutionPassword as changeInstitutionUserPassword,
  confirmPublicInstitutionVerificationByToken,
  confirmInstitutionStudentRosterImport,
  createInstitutionOrganizationInvitation,
  getInstitutionAccountSessions,
  getInstitutionAccountSettings,
  getInstitutionDashboard as fetchInstitutionDashboard,
  getInstitutionNotificationCenter as fetchInstitutionNotificationCenter,
  getInstitutionOrganization,
  getInstitutionOrganizationPeople as fetchInstitutionOrganizationPeople,
  getInstitutionOrganizationPerson,
  getInstitutionOrganizationPersonCredentials,
  getInstitutionOrganizationPersonPassportSummary,
  getInstitutionOrganizationPersonVerificationHistory,
  getInstitutionStudentRoster,
  getInstitutionStudentRosterImport,
  getInstitutionStudentRosterImportRows,
  getInstitutionStudentRosterImports,
  getInstitutionOrganizationVerificationRequests as fetchInstitutionOrganizationVerificationRequests,
  getInstitutionOrganizationTeam,
  getPublicInstitutionVerification,
  getInstitutionVerificationEvidence,
  getInstitutionVerificationRequestDetail,
  getInstitutionVerificationTimeline,
  markAllInstitutionNotificationsRead as markAllInstitutionNotificationsReadInBackend,
  markInstitutionNotificationRead as markInstitutionNotificationReadInBackend,
  removeInstitutionOrganizationMember,
  rejectInstitutionVerificationRequest,
  reportPublicInstitutionVerificationDiscrepancyByToken,
  revokeAllInstitutionAccountSessions,
  revokeInstitutionAccountSession,
  resendInstitutionOrganizationInvitation,
  restoreInstitutionOrganizationMember,
  suspendInstitutionOrganizationMember,
  transferInstitutionOrganizationOwnership,
  updateInstitutionAccountNotificationPreferences,
  updateInstitutionCurrentUserProfile,
  updateInstitutionOrganization,
  updateInstitutionVerificationPriority as updateInstitutionVerificationPriorityInBackend,
  updateInstitutionVerificationInternalNote,
  updateInstitutionOrganizationMemberRole,
  verifyInstitutionVerificationRequest,
  requestInstitutionVerificationInformation,
  requestPublicInstitutionVerificationClarificationByToken,
  downloadInstitutionStudentRosterErrorReport,
  updateInstitutionStudentRosterMapping,
  uploadInstitutionStudentRoster,
} from "./backend";
import {
  apiNotConfiguredError,
  conflictError,
  forbiddenError,
  isInstitutionError,
  notFoundError,
  serviceUnavailableError,
  unauthorizedError,
} from "./errors";
import { buildInstitutionNotificationPreferencePayload } from "./settings";
import type {
  EvidenceFile,
  InstitutionAccountPreferences,
  InstitutionDashboard,
  InstitutionNotificationCenter,
  InstitutionPersonDetailResult,
  InstitutionPassportSummary,
  InstitutionPeopleDirectory,
  InstitutionTeam,
  InstitutionSettings,
  InternalNote,
  MagicLinkRequest,
  Person,
  StudentRosterDirectory,
  StudentRosterErrorReport,
  StudentRosterImport,
  StudentRosterImportList,
  StudentRosterImportRowList,
  StudentRosterMappingAssignment,
  TeamInvitation,
  TeamMember,
  TimelineEvent,
  VerificationPriority,
  InstitutionVerificationInbox,
  InstitutionVerificationInboxFilters,
  VerificationRequest,
  VerificationStatus,
} from "./types";

interface InstitutionRepository {
  getDashboard: (organizationId: string) => Promise<InstitutionDashboard>;
  getVerificationRequests: (
    organizationId: string,
    filters?: InstitutionVerificationInboxFilters,
  ) => Promise<InstitutionVerificationInbox>;
  getVerificationRequest: (
    organizationId: string,
    id: string,
  ) => Promise<VerificationRequest | undefined>;
  getVerificationEvidence: (organizationId: string, id: string) => Promise<EvidenceFile[]>;
  getVerificationTimeline: (organizationId: string, id: string) => Promise<TimelineEvent[]>;
  respondToVerification: (
    id: string,
    action: "confirm" | "discrepancy",
    payload: { fields?: string[]; note?: string; reason?: string },
  ) => Promise<VerificationRequest | undefined>;
  requestClarification: (
    id: string,
    payload: { fields: string[]; message: string; requestDocument?: boolean },
  ) => Promise<VerificationRequest | undefined>;
  addInternalNote: (
    id: string,
    author: string,
    body: string,
  ) => Promise<VerificationRequest | undefined>;
  assignVerificationReviewer: (
    requestId: string,
    organizationMemberId?: string,
  ) => Promise<VerificationRequest | undefined>;
  cancelVerification: (
    organizationId: string,
    requestId: string,
    note?: string,
  ) => Promise<VerificationRequest | undefined>;
  updateVerificationPriority: (
    organizationId: string,
    requestId: string,
    priority: VerificationPriority,
  ) => Promise<VerificationRequest | undefined>;
  getPeople: (
    organizationId: string,
    filters?: {
      search?: string;
      lifecycleStatus?: Person["institutionStatus"] | "all";
      programme?: string;
      department?: string;
      graduationPeriod?: string;
      studentId?: string;
      verificationStatus?: string | "all";
      page?: number;
      pageSize?: number;
    },
  ) => Promise<InstitutionPeopleDirectory>;
  getPerson: (organizationId: string, id: string) => Promise<Person | undefined>;
  getPersonPassportSummary: (
    organizationId: string,
    id: string,
  ) => Promise<InstitutionPassportSummary | undefined>;
  getPersonVerificationHistory: (
    organizationId: string,
    id: string,
  ) => Promise<Person["verificationActivity"]>;
  getPersonCredentials: (organizationId: string, id: string) => Promise<Person["credentials"]>;
  getTeam: (organizationId: string) => Promise<InstitutionTeam>;
  getSettings: (organizationId: string) => Promise<InstitutionSettings>;
  updateInstitutionProfile: (
    organizationId: string,
    payload: {
      name: string;
      website?: string | null;
      location?: string | null;
      workEmail?: string | null;
      domain?: string | null;
    },
  ) => Promise<InstitutionSettings["institution"]>;
  updateAccountProfile: (payload: {
    fullName?: string | null;
    phone?: string | null;
    currentRole?: string | null;
    location?: string | null;
  }) => Promise<InstitutionAccountPreferences>;
  updateNotificationPreferences: (
    preferences: InstitutionSettings["notifications"],
  ) => Promise<InstitutionSettings["notifications"]>;
  revokeAccountSession: (sessionId: string) => Promise<void>;
  revokeAllAccountSessions: () => Promise<void>;
  changePassword: (payload: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => Promise<void>;
  getNotifications: (filters?: {
    page?: number;
    pageSize?: number;
  }) => Promise<InstitutionNotificationCenter>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  inviteTeamMember: (
    organizationId: string,
    email: string,
    role: TeamInvitation["role"],
  ) => Promise<TeamInvitation>;
  resendTeamInvitation: (organizationId: string, id: string) => Promise<TeamInvitation>;
  cancelTeamInvitation: (organizationId: string, id: string) => Promise<TeamInvitation>;
  updateTeamMemberRole: (
    organizationId: string,
    id: string,
    role: Exclude<TeamMember["role"], "owner">,
  ) => Promise<TeamMember | undefined>;
  suspendTeamMember: (organizationId: string, id: string) => Promise<TeamMember | undefined>;
  restoreTeamMember: (organizationId: string, id: string) => Promise<TeamMember | undefined>;
  removeTeamMember: (organizationId: string, id: string) => Promise<void>;
  transferTeamOwnership: (organizationId: string, id: string) => Promise<void>;
  getStudentRoster: (
    organizationId: string,
    filters?: { search?: string; page?: number; pageSize?: number },
  ) => Promise<StudentRosterDirectory>;
  uploadStudentRoster: (organizationId: string, file: File) => Promise<StudentRosterImport>;
  getStudentRosterImport: (
    organizationId: string,
    importId: string,
  ) => Promise<StudentRosterImport>;
  updateStudentRosterMapping: (
    organizationId: string,
    importId: string,
    assignments: StudentRosterMappingAssignment[],
  ) => Promise<StudentRosterImport>;
  confirmStudentRosterImport: (
    organizationId: string,
    importId: string,
  ) => Promise<StudentRosterImport>;
  getStudentRosterImportRows: (
    organizationId: string,
    importId: string,
    filters?: {
      disposition?: StudentRosterImportRowList["items"][number]["disposition"];
      applicationStatus?: StudentRosterImportRowList["items"][number]["applicationStatus"];
      page?: number;
      pageSize?: number;
    },
  ) => Promise<StudentRosterImportRowList>;
  getStudentRosterImports: (
    organizationId: string,
    filters?: { state?: StudentRosterImport["state"]; page?: number; pageSize?: number },
  ) => Promise<StudentRosterImportList>;
  downloadStudentRosterErrorReport: (
    organizationId: string,
    importId: string,
  ) => Promise<StudentRosterErrorReport>;
}

interface PublicVerificationRepository {
  getByToken: (token: string) => Promise<MagicLinkRequest>;
  confirm: (token: string, note?: string) => Promise<MagicLinkRequest>;
  reportDiscrepancy: (
    token: string,
    payload: { fields: string[]; explanation: string },
  ) => Promise<MagicLinkRequest>;
  requestClarification: (
    token: string,
    payload: { fields: string[]; message: string; requestDocument?: boolean },
  ) => Promise<MagicLinkRequest>;
}

const delay = <T>(value: T, ms = 120): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

const cloneFixture = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

interface DemoInstitutionState {
  requests: VerificationRequest[];
  people: Person[];
  team: TeamMember[];
  settings: InstitutionSettings;
  magicLinks: Record<string, MagicLinkRequest>;
  invitedByEmail: string | null;
  invitedByName: string | null;
}

const loadDemoFixtures =
  import.meta.env.VITE_DEMO_MODE === "true" ? () => import("./mock-data") : null;

let demoInstitutionState: DemoInstitutionState | null = null;

async function getDemoInstitutionState(): Promise<DemoInstitutionState> {
  if (!loadDemoFixtures) {
    throw unauthorizedError();
  }

  if (!demoInstitutionState) {
    const { mockMagicLinks, mockPeople, mockRequests, mockSettings, mockTeam } =
      await loadDemoFixtures();

    demoInstitutionState = {
      requests: cloneFixture(mockRequests),
      people: cloneFixture(mockPeople),
      team: cloneFixture(mockTeam),
      settings: cloneFixture(mockSettings),
      magicLinks: cloneFixture(mockMagicLinks),
      invitedByEmail: mockTeam[0]?.email ?? null,
      invitedByName: mockTeam[0]?.name ?? null,
    };
  }

  return demoInstitutionState;
}

function getDemoTeamMembers(state: DemoInstitutionState) {
  return state.team.filter((member) => member.status !== "pending");
}

function getDemoTeamInvitations(state: DemoInstitutionState): TeamInvitation[] {
  return state.team
    .filter((member) => member.status === "pending")
    .map((member) => ({
      id: member.id,
      email: member.email,
      role: member.role === "owner" ? "reviewer" : member.role,
      status: "pending" as const,
      invitedByEmail: state.invitedByEmail,
      invitedByName: state.invitedByName,
      invitedAt: new Date("2026-07-20T09:00:00Z").toISOString(),
      expiresAt: new Date("2026-07-27T09:00:00Z").toISOString(),
      acceptedAt: null,
      declinedAt: null,
      cancelledAt: null,
    }));
}

function assertTeamManageable() {
  if (!institutionAppConfig.demoMode) {
    throw unauthorizedError();
  }
}

function assertProtectedTeamRole(role: TeamMember["role"]) {
  if (role === "owner") {
    throw forbiddenError("Owner changes must use the dedicated ownership transfer flow.");
  }
}

function assertFinalOwnerStillActive(nextTeam: TeamMember[]) {
  const activeOwners = nextTeam.filter(
    (candidate) => candidate.role === "owner" && candidate.status === "active",
  );
  if (activeOwners.length === 0) {
    throw conflictError("The final active Owner cannot be removed or suspended.");
  }
}

function assertInstitutionBackend(feature: string): never {
  if (!institutionAppConfig.backendConfigured) {
    throw apiNotConfiguredError(feature);
  }

  throw serviceUnavailableError(
    `${feature} is not connected to the institution backend yet.`,
    `${feature} is not available yet.`,
  );
}

function assertDemoMode(feature: string) {
  if (!institutionAppConfig.demoMode) {
    assertInstitutionBackend(feature);
  }
}

function findRequestIndex(state: DemoInstitutionState, id: string) {
  return state.requests.findIndex((request) => request.id === id);
}

function assertMutableRequest(state: DemoInstitutionState, id: string) {
  const idx = findRequestIndex(state, id);
  if (idx === -1) {
    throw notFoundError("This verification request could not be found.");
  }

  const request = state.requests[idx];
  if (["confirmed", "discrepancy", "closed"].includes(request.status)) {
    throw conflictError("This verification request has already been completed.");
  }

  return { idx, request };
}

function assertMagicLinkUsable(state: DemoInstitutionState, token: string) {
  const record = state.magicLinks[token];
  if (!record) {
    throw notFoundError("This verification link is invalid.");
  }
  if (record.state !== "valid") {
    if (record.state === "completed") {
      throw conflictError("This verification link has already been used.");
    }
    throw conflictError(`This verification link is ${record.state}.`);
  }
  return record;
}

function demoInstitutionRepository(): InstitutionRepository {
  return {
    async getDashboard() {
      const state = await getDemoInstitutionState();
      const pending = state.requests.filter((request) =>
        ["pending", "in_progress", "awaiting_clarification"].includes(request.status),
      );
      return delay({
        pendingVerifications: pending.length,
        recentlyVerifiedCredentials: [],
        verificationActivity: pending.slice(0, 5).map((request) => ({
          requestId: request.id,
          eventType: request.status,
          eventSource: request.requestedBy,
          createdAt: request.receivedAt,
        })),
        people: {
          total: state.people.length,
          currentStudent: state.people.filter(
            (person) => person.institutionStatus === "current_student",
          ).length,
          alumni: state.people.filter((person) => person.institutionStatus === "alumni").length,
          withdrawn: state.people.filter((person) => person.institutionStatus === "withdrawn")
            .length,
          inactive: state.people.filter((person) => person.institutionStatus === "inactive").length,
        },
        statistics: {
          totalVerifications: state.requests.length,
          verifiedVerifications: state.requests.filter((request) =>
            ["verified", "confirmed"].includes(request.status),
          ).length,
          awaitingInformation: state.requests.filter((request) =>
            ["awaiting_information", "awaiting_clarification"].includes(request.status),
          ).length,
          highPriority: state.requests.filter(
            (request) => request.priority === "high" || request.priority === "urgent",
          ).length,
        },
      });
    },
    async getVerificationRequests(_organizationId, filters) {
      const state = await getDemoInstitutionState();
      let items = cloneFixture(state.requests);
      if (filters?.search?.trim()) {
        const needle = filters.search.trim().toLowerCase();
        items = items.filter((request) =>
          [request.candidateName, request.reference, request.requestPurpose]
            .filter(Boolean)
            .some((value) => value?.toLowerCase().includes(needle)),
        );
      }
      if (filters?.status && filters.status !== "all") {
        items = items.filter((request) => request.status === filters.status);
      }
      if (filters?.priority && filters.priority !== "all") {
        items = items.filter((request) => request.priority === filters.priority);
      }
      if (filters?.requestType && filters.requestType !== "all") {
        items = items.filter((request) => request.requestType === filters.requestType);
      }
      if (filters?.assignedToMe) {
        items = items.filter((request) => request.isAssignedToCurrentUser);
      }

      return delay({
        items,
        total: items.length,
        page: 1,
        pageSize: items.length || 25,
        totalPages: 1,
        offset: 0,
        limit: items.length || 25,
      });
    },
    async getVerificationRequest(_organizationId, id) {
      const state = await getDemoInstitutionState();
      return delay(cloneFixture(state.requests.find((request) => request.id === id)));
    },
    async getVerificationEvidence(_organizationId, id) {
      const state = await getDemoInstitutionState();
      const request = state.requests.find((candidate) => candidate.id === id);
      if (!request) {
        throw notFoundError("This verification request could not be found.");
      }

      return delay(cloneFixture(request.evidence));
    },
    async getVerificationTimeline(_organizationId, id) {
      const state = await getDemoInstitutionState();
      const request = state.requests.find((candidate) => candidate.id === id);
      if (!request) {
        throw notFoundError("This verification request could not be found.");
      }

      return delay(cloneFixture(request.timeline));
    },
    async respondToVerification(id, action, payload) {
      const state = await getDemoInstitutionState();
      const { idx } = assertMutableRequest(state, id);
      const now = new Date().toISOString();
      const status: VerificationStatus = action === "confirm" ? "confirmed" : "discrepancy";
      const label = action === "confirm" ? "Verification confirmed" : "Discrepancy reported";

      state.requests[idx] = {
        ...state.requests[idx],
        status,
        timeline: [
          ...state.requests[idx].timeline,
          {
            id: `timeline_${Date.now()}`,
            at: now,
            label,
            detail: payload.note ?? payload.reason,
          },
        ],
      };

      return delay(cloneFixture(state.requests[idx]));
    },
    async requestClarification(id, payload) {
      const state = await getDemoInstitutionState();
      const { idx } = assertMutableRequest(state, id);
      const now = new Date().toISOString();

      state.requests[idx] = {
        ...state.requests[idx],
        status: "awaiting_clarification",
        timeline: [
          ...state.requests[idx].timeline,
          {
            id: `timeline_${Date.now()}`,
            at: now,
            label: "Clarification requested",
            detail: payload.fields.join(", "),
          },
        ],
      };

      return delay(cloneFixture(state.requests[idx]));
    },
    async addInternalNote(id, author, body) {
      const state = await getDemoInstitutionState();
      const idx = findRequestIndex(state, id);
      if (idx === -1) {
        throw notFoundError("This verification request could not be found.");
      }

      state.requests[idx] = {
        ...state.requests[idx],
        internalNotes: [
          ...state.requests[idx].internalNotes,
          {
            id: `note_${Date.now()}`,
            author,
            body,
            createdAt: new Date().toISOString(),
          },
        ],
      };

      return delay(cloneFixture(state.requests[idx]));
    },
    async assignVerificationReviewer(requestId, organizationMemberId) {
      const state = await getDemoInstitutionState();
      const idx = findRequestIndex(state, requestId);
      if (idx === -1) {
        throw notFoundError("This verification request could not be found.");
      }

      const assignee = state.team.find(
        (candidate) =>
          candidate.id === organizationMemberId &&
          candidate.status === "active" &&
          candidate.role !== "member",
      );

      state.requests[idx] = {
        ...state.requests[idx],
        assignedTo: assignee?.name,
        timeline: [
          ...state.requests[idx].timeline,
          {
            id: `timeline_${Date.now()}`,
            at: new Date().toISOString(),
            label: "Reviewer assigned",
            detail: assignee?.name ?? "Assignment cleared",
          },
        ],
      };

      return delay(cloneFixture(state.requests[idx]));
    },
    async cancelVerification(_organizationId, requestId, note) {
      const state = await getDemoInstitutionState();
      const { idx } = assertMutableRequest(state, requestId);
      state.requests[idx] = {
        ...state.requests[idx],
        status: "cancelled",
        timeline: [
          ...state.requests[idx].timeline,
          {
            id: `timeline_${Date.now()}`,
            at: new Date().toISOString(),
            label: "Verification cancelled",
            detail: note,
          },
        ],
      };
      return delay(cloneFixture(state.requests[idx]));
    },
    async updateVerificationPriority(_organizationId, requestId, priority) {
      const state = await getDemoInstitutionState();
      const idx = findRequestIndex(state, requestId);
      if (idx === -1) {
        throw notFoundError("This verification request could not be found.");
      }
      state.requests[idx] = {
        ...state.requests[idx],
        priority,
      };
      return delay(cloneFixture(state.requests[idx]));
    },
    async getPeople() {
      const state = await getDemoInstitutionState();
      const pageSize = 25;
      return delay({
        items: cloneFixture(state.people),
        total: state.people.length,
        page: 1,
        pageSize,
        totalPages: Math.max(1, Math.ceil(state.people.length / pageSize)),
        offset: 0,
        limit: pageSize,
      });
    },
    async getPerson(_organizationId, id) {
      const state = await getDemoInstitutionState();
      return delay(cloneFixture(state.people.find((person) => person.id === id)));
    },
    async getPersonPassportSummary(_organizationId, id) {
      const state = await getDemoInstitutionState();
      const person = state.people.find((candidate) => candidate.id === id);
      if (!person) {
        throw notFoundError("This person could not be found.");
      }

      return delay({
        personId: person.id,
        displayName: person.name,
        lifecycleStatus: person.institutionStatus,
        degree: person.relationship.degree,
        programme: person.relationship.programme,
        department: person.relationship.department,
        admissionPeriod: person.relationship.admissionPeriod,
        graduationPeriod: person.relationship.graduationPeriod,
        verificationStatus: person.trustStatus,
        consentedProfessionalFields: person.sharedProfile.consentedFields ?? [],
        professionalInformation: (person.sharedProfile.fields ?? []).map((field) => ({
          field: field.field,
          value: field.value,
          consentedAt: field.consentedAt,
          expiresAt: field.expiresAt,
        })),
        credentials: person.credentials.map((credential) => ({
          id: credential.id,
          title: credential.name,
          credentialType: credential.credentialType || "credential",
          status: credential.status,
          issuedPeriod: credential.issuePeriod || credential.issueDate,
        })),
      });
    },
    async getPersonVerificationHistory(_organizationId, id) {
      const state = await getDemoInstitutionState();
      const person = state.people.find((candidate) => candidate.id === id);
      if (!person) {
        throw notFoundError("This person could not be found.");
      }

      return delay(cloneFixture(person.verificationActivity));
    },
    async getPersonCredentials(_organizationId, id) {
      const state = await getDemoInstitutionState();
      const person = state.people.find((candidate) => candidate.id === id);
      if (!person) {
        throw notFoundError("This person could not be found.");
      }

      return delay(cloneFixture(person.credentials));
    },
    async getTeam() {
      const state = await getDemoInstitutionState();
      return delay(
        cloneFixture({
          members: getDemoTeamMembers(state),
          invitations: getDemoTeamInvitations(state),
        }),
      );
    },
    async getSettings() {
      const state = await getDemoInstitutionState();
      return delay(cloneFixture(state.settings));
    },
    async updateInstitutionProfile(_organizationId, payload) {
      const state = await getDemoInstitutionState();
      state.settings = {
        ...state.settings,
        institution: {
          ...state.settings.institution,
          name: payload.name ?? state.settings.institution.name,
          website: payload.website ?? state.settings.institution.website,
          location: payload.location ?? state.settings.institution.location ?? null,
          address: payload.location ?? state.settings.institution.address,
          workEmail: payload.workEmail ?? state.settings.institution.workEmail ?? null,
          primaryVerificationEmail:
            payload.workEmail ?? state.settings.institution.primaryVerificationEmail,
          domain: payload.domain ?? state.settings.institution.domain,
        },
      };
      return delay(cloneFixture(state.settings.institution));
    },
    async updateAccountProfile(payload) {
      const state = await getDemoInstitutionState();
      state.settings = {
        ...state.settings,
        account: {
          ...state.settings.account,
          fullName: payload.fullName ?? state.settings.account.fullName,
          phone: payload.phone ?? state.settings.account.phone ?? null,
          currentRole: payload.currentRole ?? state.settings.account.currentRole ?? null,
          location: payload.location ?? state.settings.account.location ?? null,
        },
      };
      return delay(cloneFixture(state.settings.account));
    },
    async updateNotificationPreferences(preferences) {
      const state = await getDemoInstitutionState();
      state.settings = {
        ...state.settings,
        notifications: cloneFixture(preferences).map((preference) => ({
          ...preference,
          enabled: preference.required ? true : preference.enabled,
        })),
      };
      return delay(cloneFixture(state.settings.notifications));
    },
    async revokeAccountSession(sessionId) {
      const state = await getDemoInstitutionState();
      state.settings = {
        ...state.settings,
        sessions: state.settings.sessions.filter((session) => session.id !== sessionId),
      };
      return delay(undefined);
    },
    async revokeAllAccountSessions() {
      const state = await getDemoInstitutionState();
      state.settings = {
        ...state.settings,
        sessions: [],
      };
      return delay(undefined);
    },
    async changePassword() {
      return delay(undefined);
    },
    async getNotifications(filters) {
      const pageSize = Math.max(filters?.pageSize ?? 10, 1);
      const page = Math.max(filters?.page ?? 1, 1);
      const items: InstitutionNotificationCenter["items"] = [];
      return delay({
        items,
        total: 0,
        page,
        pageSize,
        totalPages: 0,
        offset: (page - 1) * pageSize,
        limit: pageSize,
        unreadCount: 0,
      });
    },
    async markNotificationRead() {
      return delay(undefined);
    },
    async markAllNotificationsRead() {
      return delay(undefined);
    },
    async inviteTeamMember(_organizationId, email, role) {
      assertTeamManageable();
      const state = await getDemoInstitutionState();
      const invitation: TeamMember = {
        id: `invite_${Date.now()}`,
        name: email.split("@")[0],
        email,
        role,
        status: "pending",
      };
      state.team = [...state.team, invitation];
      const createdInvitation = getDemoTeamInvitations(state).find(
        (candidate) => candidate.id === invitation.id,
      );
      if (!createdInvitation) {
        throw notFoundError("This invitation could not be created.");
      }

      return delay(cloneFixture(createdInvitation));
    },
    async resendTeamInvitation(_organizationId, id) {
      const state = await getDemoInstitutionState();
      const invitation = getDemoTeamInvitations(state).find((candidate) => candidate.id === id);
      if (!invitation) {
        throw notFoundError("This invitation could not be found.");
      }

      return delay(
        cloneFixture({
          ...invitation,
          invitedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      );
    },
    async cancelTeamInvitation(_organizationId, id) {
      const state = await getDemoInstitutionState();
      const invitation = state.team.find(
        (candidate) => candidate.id === id && candidate.status === "pending",
      );
      if (!invitation) {
        throw notFoundError("This invitation could not be found.");
      }

      state.team = state.team.filter((candidate) => candidate.id !== id);
      return delay(
        cloneFixture({
          id,
          email: invitation.email,
          role: invitation.role === "owner" ? "reviewer" : invitation.role,
          status: "cancelled" as const,
          invitedByEmail: state.invitedByEmail,
          invitedByName: state.invitedByName,
          invitedAt: new Date("2026-07-20T09:00:00Z").toISOString(),
          expiresAt: new Date("2026-07-27T09:00:00Z").toISOString(),
          acceptedAt: null,
          declinedAt: null,
          cancelledAt: new Date().toISOString(),
        }),
      );
    },
    async updateTeamMemberRole(_organizationId, id, role) {
      const state = await getDemoInstitutionState();
      const member = state.team.find((candidate) => candidate.id === id);
      if (!member) {
        throw notFoundError("This team member could not be found.");
      }
      assertProtectedTeamRole(role);
      if (member.role === "owner") {
        throw forbiddenError("Owner changes must use the dedicated ownership transfer flow.");
      }

      const nextTeam = state.team.map((candidate) =>
        candidate.id === id ? { ...candidate, role } : candidate,
      );

      state.team = nextTeam;
      return delay(cloneFixture(state.team.find((candidate) => candidate.id === id)));
    },
    async suspendTeamMember(_organizationId, id) {
      const state = await getDemoInstitutionState();
      const member = state.team.find((candidate) => candidate.id === id);
      if (!member) {
        throw notFoundError("This team member could not be found.");
      }

      const nextTeam = state.team.map((candidate) =>
        candidate.id === id ? { ...candidate, status: "suspended" as const } : candidate,
      );
      assertFinalOwnerStillActive(nextTeam);
      state.team = nextTeam;
      return delay(cloneFixture(state.team.find((candidate) => candidate.id === id)));
    },
    async restoreTeamMember(_organizationId, id) {
      const state = await getDemoInstitutionState();
      const member = state.team.find((candidate) => candidate.id === id);
      if (!member) {
        throw notFoundError("This team member could not be found.");
      }

      state.team = state.team.map((candidate) =>
        candidate.id === id ? { ...candidate, status: "active" as const } : candidate,
      );
      return delay(cloneFixture(state.team.find((candidate) => candidate.id === id)));
    },
    async removeTeamMember(_organizationId, id) {
      const state = await getDemoInstitutionState();
      const member = state.team.find((candidate) => candidate.id === id);
      if (!member) {
        throw notFoundError("This team member could not be found.");
      }

      const nextTeam = state.team.filter((candidate) => candidate.id !== id);
      if (member.role === "owner" && member.status === "active") {
        assertFinalOwnerStillActive(nextTeam);
      }

      state.team = nextTeam;
      return delay(undefined);
    },
    async transferTeamOwnership(_organizationId, id) {
      const state = await getDemoInstitutionState();
      const target = state.team.find((candidate) => candidate.id === id);
      if (!target) {
        throw notFoundError("This team member could not be found.");
      }
      if (target.status !== "active") {
        throw conflictError("Only active team members can receive ownership.");
      }
      if (target.role === "owner") {
        return delay(undefined);
      }

      let ownerTransferred = false;
      state.team = state.team.map((candidate) => {
        if (candidate.role === "owner" && candidate.status === "active" && !ownerTransferred) {
          ownerTransferred = true;
          return { ...candidate, role: "admin" as const };
        }
        if (candidate.id === id) {
          return { ...candidate, role: "owner" as const };
        }
        return candidate;
      });

      return delay(undefined);
    },
    async getStudentRoster() {
      assertInstitutionBackend("Student roster");
    },
    async uploadStudentRoster() {
      assertInstitutionBackend("Student roster imports");
    },
    async getStudentRosterImport() {
      assertInstitutionBackend("Student roster imports");
    },
    async updateStudentRosterMapping() {
      assertInstitutionBackend("Student roster imports");
    },
    async confirmStudentRosterImport() {
      assertInstitutionBackend("Student roster imports");
    },
    async getStudentRosterImportRows() {
      assertInstitutionBackend("Student roster imports");
    },
    async getStudentRosterImports() {
      assertInstitutionBackend("Student roster imports");
    },
    async downloadStudentRosterErrorReport() {
      assertInstitutionBackend("Student roster imports");
    },
  };
}

function unavailableInstitutionRepository(): InstitutionRepository {
  return {
    async getDashboard() {
      assertInstitutionBackend("Institution dashboard");
    },
    async getVerificationRequests() {
      assertInstitutionBackend("Verification requests");
    },
    async getVerificationRequest() {
      assertInstitutionBackend("Verification requests");
    },
    async getVerificationEvidence() {
      assertInstitutionBackend("Verification evidence");
    },
    async getVerificationTimeline() {
      assertInstitutionBackend("Verification timeline");
    },
    async respondToVerification() {
      assertInstitutionBackend("Verification responses");
    },
    async requestClarification() {
      assertInstitutionBackend("Verification responses");
    },
    async addInternalNote() {
      assertInstitutionBackend("Internal verification notes");
    },
    async assignVerificationReviewer() {
      assertInstitutionBackend("Verification reviewer assignment");
    },
    async cancelVerification() {
      assertInstitutionBackend("Verification responses");
    },
    async updateVerificationPriority() {
      assertInstitutionBackend("Verification priority");
    },
    async getPeople() {
      assertInstitutionBackend("Institution people");
    },
    async getPerson() {
      assertInstitutionBackend("Institution people");
    },
    async getPersonPassportSummary() {
      assertInstitutionBackend("Institution people");
    },
    async getPersonVerificationHistory() {
      assertInstitutionBackend("Institution people");
    },
    async getPersonCredentials() {
      assertInstitutionBackend("Institution people");
    },
    async getTeam() {
      assertInstitutionBackend("Institution team");
    },
    async getSettings() {
      assertInstitutionBackend("Institution settings");
    },
    async updateInstitutionProfile() {
      assertInstitutionBackend("Institution settings");
    },
    async updateAccountProfile() {
      assertInstitutionBackend("Institution settings");
    },
    async updateNotificationPreferences() {
      assertInstitutionBackend("Institution settings");
    },
    async revokeAccountSession() {
      assertInstitutionBackend("Institution settings");
    },
    async revokeAllAccountSessions() {
      assertInstitutionBackend("Institution settings");
    },
    async changePassword() {
      assertInstitutionBackend("Institution settings");
    },
    async getNotifications() {
      assertInstitutionBackend("Notification center");
    },
    async markNotificationRead() {
      assertInstitutionBackend("Notification center");
    },
    async markAllNotificationsRead() {
      assertInstitutionBackend("Notification center");
    },
    async inviteTeamMember() {
      assertInstitutionBackend("Institution team management");
    },
    async resendTeamInvitation() {
      assertInstitutionBackend("Institution team management");
    },
    async cancelTeamInvitation() {
      assertInstitutionBackend("Institution team management");
    },
    async updateTeamMemberRole() {
      assertInstitutionBackend("Institution team management");
    },
    async suspendTeamMember() {
      assertInstitutionBackend("Institution team management");
    },
    async restoreTeamMember() {
      assertInstitutionBackend("Institution team management");
    },
    async removeTeamMember() {
      assertInstitutionBackend("Institution team management");
    },
    async transferTeamOwnership() {
      assertInstitutionBackend("Institution team management");
    },
    async getStudentRoster() {
      assertInstitutionBackend("Student roster");
    },
    async uploadStudentRoster() {
      assertInstitutionBackend("Student roster imports");
    },
    async getStudentRosterImport() {
      assertInstitutionBackend("Student roster imports");
    },
    async updateStudentRosterMapping() {
      assertInstitutionBackend("Student roster imports");
    },
    async confirmStudentRosterImport() {
      assertInstitutionBackend("Student roster imports");
    },
    async getStudentRosterImportRows() {
      assertInstitutionBackend("Student roster imports");
    },
    async getStudentRosterImports() {
      assertInstitutionBackend("Student roster imports");
    },
    async downloadStudentRosterErrorReport() {
      assertInstitutionBackend("Student roster imports");
    },
  };
}

function backendInstitutionRepository(): InstitutionRepository {
  const unavailable = unavailableInstitutionRepository();

  return {
    ...unavailable,
    async getDashboard(organizationId) {
      return fetchInstitutionDashboard(organizationId);
    },
    async getVerificationRequests(organizationId, filters) {
      return fetchInstitutionOrganizationVerificationRequests(organizationId, filters);
    },
    async getVerificationRequest(organizationId, id) {
      return getInstitutionVerificationRequestDetail(organizationId, id);
    },
    async getVerificationEvidence(organizationId, id) {
      return getInstitutionVerificationEvidence(organizationId, id);
    },
    async getVerificationTimeline(organizationId, id) {
      return getInstitutionVerificationTimeline(organizationId, id);
    },
    async respondToVerification(id, action, payload) {
      if (action === "confirm") {
        return verifyInstitutionVerificationRequest(id, {
          note: payload.note,
          metadata: payload.fields?.length ? { fields: payload.fields } : undefined,
        });
      }

      return rejectInstitutionVerificationRequest(id, {
        note: payload.reason,
        metadata: payload.fields?.length ? { fields: payload.fields } : undefined,
      });
    },
    async requestClarification(id, payload) {
      return requestInstitutionVerificationInformation(id, {
        note: payload.message,
        metadata: {
          fields: payload.fields,
          request_document: payload.requestDocument ?? false,
        },
      });
    },
    async addInternalNote(id, _author, body) {
      return updateInstitutionVerificationInternalNote(id, body);
    },
    async assignVerificationReviewer(requestId, organizationMemberId) {
      return assignInstitutionVerificationReviewer(requestId, {
        organizationMemberPublicId: organizationMemberId,
      });
    },
    async cancelVerification(organizationId, requestId, note) {
      return cancelInstitutionVerificationRequest(organizationId, requestId, { note });
    },
    async updateVerificationPriority(organizationId, requestId, priority) {
      return updateInstitutionVerificationPriorityInBackend(organizationId, requestId, priority);
    },
    async getPeople(organizationId, filters) {
      return fetchInstitutionOrganizationPeople(organizationId, filters);
    },
    async getPerson(organizationId, id) {
      return getInstitutionOrganizationPerson(organizationId, id);
    },
    async getPersonPassportSummary(organizationId, id) {
      return getInstitutionOrganizationPersonPassportSummary(organizationId, id);
    },
    async getPersonVerificationHistory(organizationId, id) {
      return getInstitutionOrganizationPersonVerificationHistory(organizationId, id);
    },
    async getPersonCredentials(organizationId, id) {
      return getInstitutionOrganizationPersonCredentials(organizationId, id);
    },
    async getTeam(organizationId) {
      return getInstitutionOrganizationTeam(organizationId);
    },
    async getSettings(organizationId) {
      const [institution, accountSettings, sessions] = await Promise.all([
        getInstitutionOrganization(organizationId),
        getInstitutionAccountSettings(),
        getInstitutionAccountSessions(),
      ]);

      return {
        institution,
        account: accountSettings.account,
        notifications: accountSettings.notifications,
        sessions,
        security: {
          domainVerified: Boolean(institution.domainVerifiedAt),
          domainVerifiedAt: institution.domainVerifiedAt,
          canChangePassword: true,
        },
        workspace: {
          verificationPreferencesAvailable: false,
          integrationConnectionsAvailable: false,
          sessionDeviceDetailsAvailable: true,
          mfaAvailable: false,
          securityHistoryAvailable: false,
        },
      };
    },
    async updateInstitutionProfile(organizationId, payload) {
      return updateInstitutionOrganization(organizationId, payload);
    },
    async updateAccountProfile(payload) {
      return updateInstitutionCurrentUserProfile(payload);
    },
    async updateNotificationPreferences(preferences) {
      return updateInstitutionAccountNotificationPreferences(
        buildInstitutionNotificationPreferencePayload(preferences),
      );
    },
    async revokeAccountSession(sessionId) {
      return revokeInstitutionAccountSession(sessionId);
    },
    async revokeAllAccountSessions() {
      return revokeAllInstitutionAccountSessions();
    },
    async changePassword(payload) {
      return changeInstitutionUserPassword(payload);
    },
    async getNotifications(filters) {
      return fetchInstitutionNotificationCenter(filters);
    },
    async markNotificationRead(id) {
      return markInstitutionNotificationReadInBackend(id);
    },
    async markAllNotificationsRead() {
      return markAllInstitutionNotificationsReadInBackend();
    },
    async inviteTeamMember(organizationId, email, role) {
      return createInstitutionOrganizationInvitation(organizationId, {
        inviteeEmail: email,
        role,
      });
    },
    async resendTeamInvitation(organizationId, id) {
      return resendInstitutionOrganizationInvitation(organizationId, id);
    },
    async cancelTeamInvitation(organizationId, id) {
      return cancelInstitutionOrganizationInvitation(organizationId, id);
    },
    async updateTeamMemberRole(organizationId, id, role) {
      return updateInstitutionOrganizationMemberRole(organizationId, id, { role });
    },
    async suspendTeamMember(organizationId, id) {
      return suspendInstitutionOrganizationMember(organizationId, id);
    },
    async restoreTeamMember(organizationId, id) {
      return restoreInstitutionOrganizationMember(organizationId, id);
    },
    async removeTeamMember(organizationId, id) {
      return removeInstitutionOrganizationMember(organizationId, id);
    },
    async transferTeamOwnership(organizationId, id) {
      return transferInstitutionOrganizationOwnership(organizationId, id);
    },
    async getStudentRoster(organizationId, filters) {
      return getInstitutionStudentRoster(organizationId, filters);
    },
    async uploadStudentRoster(organizationId, file) {
      return uploadInstitutionStudentRoster(organizationId, file);
    },
    async getStudentRosterImport(organizationId, importId) {
      return getInstitutionStudentRosterImport(organizationId, importId);
    },
    async updateStudentRosterMapping(organizationId, importId, assignments) {
      return updateInstitutionStudentRosterMapping(organizationId, importId, assignments);
    },
    async confirmStudentRosterImport(organizationId, importId) {
      return confirmInstitutionStudentRosterImport(organizationId, importId);
    },
    async getStudentRosterImportRows(organizationId, importId, filters) {
      return getInstitutionStudentRosterImportRows(organizationId, importId, filters);
    },
    async getStudentRosterImports(organizationId, filters) {
      return getInstitutionStudentRosterImports(organizationId, filters);
    },
    async downloadStudentRosterErrorReport(organizationId, importId) {
      return downloadInstitutionStudentRosterErrorReport(organizationId, importId);
    },
  };
}

function demoPublicVerificationRepository(): PublicVerificationRepository {
  return {
    async getByToken(token) {
      const state = await getDemoInstitutionState();
      return delay(cloneFixture(state.magicLinks[token] ?? { state: "invalid" }));
    },
    async confirm(token, note) {
      const state = await getDemoInstitutionState();
      const record = assertMagicLinkUsable(state, token);
      state.magicLinks[token] = {
        ...record,
        state: "completed",
      };
      return delay(
        cloneFixture({
          ...state.magicLinks[token],
          request: record.request
            ? {
                ...record.request,
                purpose: note?.trim() ? record.request.purpose : record.request.purpose,
              }
            : undefined,
        }),
      );
    },
    async reportDiscrepancy(token) {
      const state = await getDemoInstitutionState();
      const record = assertMagicLinkUsable(state, token);
      state.magicLinks[token] = {
        ...record,
        state: "completed",
      };
      return delay(cloneFixture(state.magicLinks[token]));
    },
    async requestClarification(token) {
      const state = await getDemoInstitutionState();
      const record = assertMagicLinkUsable(state, token);
      state.magicLinks[token] = {
        ...record,
        state: "completed",
      };
      return delay(cloneFixture(state.magicLinks[token]));
    },
  };
}

function backendPublicVerificationRepository(): PublicVerificationRepository {
  return {
    async getByToken(token) {
      return getPublicInstitutionVerification(token);
    },
    async confirm(token, note) {
      return confirmPublicInstitutionVerificationByToken(token, { note });
    },
    async reportDiscrepancy(token, payload) {
      return reportPublicInstitutionVerificationDiscrepancyByToken(token, payload);
    },
    async requestClarification(token, payload) {
      return requestPublicInstitutionVerificationClarificationByToken(token, payload);
    },
  };
}

const institutionRepository = institutionAppConfig.demoMode
  ? demoInstitutionRepository()
  : backendInstitutionRepository();
const publicVerificationRepository = institutionAppConfig.demoMode
  ? demoPublicVerificationRepository()
  : backendPublicVerificationRepository();

export async function getInstitutionDashboard(
  organizationId: string,
): Promise<InstitutionDashboard> {
  return institutionRepository.getDashboard(organizationId);
}

export async function getInstitutionVerificationRequests(
  organizationId: string,
  filters?: InstitutionVerificationInboxFilters,
): Promise<InstitutionVerificationInbox> {
  return institutionRepository.getVerificationRequests(organizationId, filters);
}

export async function getInstitutionVerificationRequest(
  organizationId: string,
  id: string,
): Promise<VerificationRequest | undefined> {
  return institutionRepository.getVerificationRequest(organizationId, id);
}

export async function respondToInstitutionVerification(
  id: string,
  action: "confirm" | "discrepancy",
  payload: { fields?: string[]; note?: string; reason?: string },
): Promise<VerificationRequest | undefined> {
  return institutionRepository.respondToVerification(id, action, payload);
}

export async function requestInstitutionClarification(
  id: string,
  payload: { fields: string[]; message: string; requestDocument?: boolean },
): Promise<VerificationRequest | undefined> {
  return institutionRepository.requestClarification(id, payload);
}

export async function addInternalNote(
  id: string,
  author: string,
  body: string,
): Promise<VerificationRequest | undefined> {
  return institutionRepository.addInternalNote(id, author, body);
}

export async function getInstitutionOrganizationVerificationRequests(
  organizationId: string,
  filters?: InstitutionVerificationInboxFilters,
): Promise<InstitutionVerificationInbox> {
  return institutionRepository.getVerificationRequests(organizationId, filters);
}

export async function getInstitutionVerificationEvidenceItems(
  organizationId: string,
  id: string,
): Promise<EvidenceFile[]> {
  return institutionRepository.getVerificationEvidence(organizationId, id);
}

export async function getInstitutionVerificationTimelineItems(
  organizationId: string,
  id: string,
): Promise<TimelineEvent[]> {
  return institutionRepository.getVerificationTimeline(organizationId, id);
}

export async function assignInstitutionVerificationRequestReviewer(
  requestId: string,
  organizationMemberId?: string,
): Promise<VerificationRequest | undefined> {
  return institutionRepository.assignVerificationReviewer(requestId, organizationMemberId);
}

export async function cancelInstitutionVerification(
  organizationId: string,
  requestId: string,
  note?: string,
): Promise<VerificationRequest | undefined> {
  return institutionRepository.cancelVerification(organizationId, requestId, note);
}

export async function setInstitutionVerificationPriority(
  organizationId: string,
  requestId: string,
  priority: VerificationPriority,
): Promise<VerificationRequest | undefined> {
  return institutionRepository.updateVerificationPriority(organizationId, requestId, priority);
}

export async function getInstitutionPeople(
  organizationId: string,
  filters?: {
    search?: string;
    lifecycleStatus?: Person["institutionStatus"] | "all";
    programme?: string;
    department?: string;
    graduationPeriod?: string;
    studentId?: string;
    verificationStatus?: string | "all";
    page?: number;
    pageSize?: number;
  },
): Promise<InstitutionPeopleDirectory> {
  return institutionRepository.getPeople(organizationId, filters);
}

export async function getInstitutionPerson(
  organizationId: string,
  id: string,
): Promise<Person | undefined> {
  return institutionRepository.getPerson(organizationId, id);
}

export async function getInstitutionPersonDetail(
  organizationId: string,
  id: string,
  rosterSource?: { importId?: string; rowNumber?: number },
): Promise<InstitutionPersonDetailResult> {
  try {
    const person = await institutionRepository.getPerson(organizationId, id);
    if (!person) throw notFoundError("This person could not be found.");
    return { kind: "institution", person };
  } catch (error) {
    if (!isInstitutionError(error) || error.status !== 404) throw error;
  }

  const sourceImportId = rosterSource?.importId;
  const sourceRowNumber = rosterSource?.rowNumber;
  const sourceMatches =
    typeof sourceImportId === "string" &&
    sourceImportId.length > 0 &&
    sourceRowNumber &&
    Number.isInteger(sourceRowNumber) &&
    sourceRowNumber > 1;

  if (!sourceMatches) {
    throw notFoundError("The organization-provided source record could not be resolved.");
  }

  const pageSize = 100;
  const page = Math.floor((sourceRowNumber - 2) / pageSize) + 1;
  const rows = await institutionRepository.getStudentRosterImportRows(
    organizationId,
    sourceImportId,
    { page, pageSize },
  );
  const sourceRow = rows.items.find(
    (row) => row.rowNumber === sourceRowNumber && row.resultOrganizationPersonId === id,
  );
  const fullName = sourceRow?.normalizedValues.full_name;
  if (!sourceRow || typeof fullName !== "string" || !fullName.trim() || !sourceRow.appliedAt) {
    throw notFoundError("The organization-provided source record could not be resolved.");
  }

  const email = sourceRow.normalizedValues.institutional_email;
  const phone = sourceRow.normalizedValues.phone;

  return {
    kind: "organization_roster",
    person: {
      id,
      fullName: fullName.trim(),
      email: typeof email === "string" ? email : null,
      phone: typeof phone === "string" ? phone : null,
      rosterData: sourceRow.normalizedValues,
      sourceStatus: "organization_provided",
      verified: false,
      sourceImportId,
      sourceRowNumber,
      importedAt: sourceRow.appliedAt,
    },
  };
}

export async function getInstitutionPersonPassportSummary(
  organizationId: string,
  id: string,
): Promise<InstitutionPassportSummary | undefined> {
  return institutionRepository.getPersonPassportSummary(organizationId, id);
}

export async function getInstitutionPersonVerificationHistory(
  organizationId: string,
  id: string,
): Promise<Person["verificationActivity"]> {
  return institutionRepository.getPersonVerificationHistory(organizationId, id);
}

export async function getInstitutionPersonCredentials(
  organizationId: string,
  id: string,
): Promise<Person["credentials"]> {
  return institutionRepository.getPersonCredentials(organizationId, id);
}

export async function getInstitutionStudentRosterDirectory(
  organizationId: string,
  filters?: { search?: string; page?: number; pageSize?: number },
) {
  return institutionRepository.getStudentRoster(organizationId, filters);
}

export async function uploadInstitutionStudentRosterFile(organizationId: string, file: File) {
  return institutionRepository.uploadStudentRoster(organizationId, file);
}

export async function getInstitutionStudentRosterImportDetail(
  organizationId: string,
  importId: string,
) {
  return institutionRepository.getStudentRosterImport(organizationId, importId);
}

export async function saveInstitutionStudentRosterMapping(
  organizationId: string,
  importId: string,
  assignments: StudentRosterMappingAssignment[],
) {
  return institutionRepository.updateStudentRosterMapping(organizationId, importId, assignments);
}

export async function confirmInstitutionStudentRoster(organizationId: string, importId: string) {
  return institutionRepository.confirmStudentRosterImport(organizationId, importId);
}

export async function getInstitutionStudentRosterRows(
  organizationId: string,
  importId: string,
  filters?: {
    disposition?: StudentRosterImportRowList["items"][number]["disposition"];
    applicationStatus?: StudentRosterImportRowList["items"][number]["applicationStatus"];
    page?: number;
    pageSize?: number;
  },
) {
  return institutionRepository.getStudentRosterImportRows(organizationId, importId, filters);
}

export async function getInstitutionStudentRosterImportHistory(
  organizationId: string,
  filters?: { state?: StudentRosterImport["state"]; page?: number; pageSize?: number },
) {
  return institutionRepository.getStudentRosterImports(organizationId, filters);
}

export async function getInstitutionStudentRosterErrorReport(
  organizationId: string,
  importId: string,
) {
  return institutionRepository.downloadStudentRosterErrorReport(organizationId, importId);
}

export async function getInstitutionTeam(organizationId: string): Promise<InstitutionTeam> {
  return institutionRepository.getTeam(organizationId);
}

export async function getInstitutionSettings(organizationId: string): Promise<InstitutionSettings> {
  return institutionRepository.getSettings(organizationId);
}

export async function updateInstitutionProfile(
  organizationId: string,
  payload: {
    name: string;
    website?: string | null;
    location?: string | null;
    workEmail?: string | null;
    domain?: string | null;
  },
) {
  return institutionRepository.updateInstitutionProfile(organizationId, payload);
}

export async function updateInstitutionAccountProfile(payload: {
  fullName?: string | null;
  phone?: string | null;
  currentRole?: string | null;
  location?: string | null;
}) {
  return institutionRepository.updateAccountProfile(payload);
}

export async function updateInstitutionNotificationPreferences(
  preferences: InstitutionSettings["notifications"],
) {
  return institutionRepository.updateNotificationPreferences(preferences);
}

export async function revokeInstitutionSession(sessionId: string) {
  return institutionRepository.revokeAccountSession(sessionId);
}

export async function revokeAllInstitutionSessions() {
  return institutionRepository.revokeAllAccountSessions();
}

export async function changeInstitutionPassword(payload: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}) {
  return institutionRepository.changePassword(payload);
}

export async function getInstitutionNotifications(filters?: {
  page?: number;
  pageSize?: number;
}): Promise<InstitutionNotificationCenter> {
  return institutionRepository.getNotifications(filters);
}

export async function markInstitutionNotificationRead(id: string) {
  return institutionRepository.markNotificationRead(id);
}

export async function markAllInstitutionNotificationsRead() {
  return institutionRepository.markAllNotificationsRead();
}

export async function getPublicInstitutionVerificationByToken(
  token: string,
): Promise<MagicLinkRequest> {
  return publicVerificationRepository.getByToken(token);
}

export async function confirmPublicInstitutionVerification(
  token: string,
  payload: { note?: string },
): Promise<MagicLinkRequest> {
  return publicVerificationRepository.confirm(token, payload.note);
}

export async function reportPublicInstitutionVerificationDiscrepancy(
  token: string,
  payload: { fields: string[]; explanation: string },
): Promise<MagicLinkRequest> {
  return publicVerificationRepository.reportDiscrepancy(token, payload);
}

export async function requestPublicInstitutionVerificationClarification(
  token: string,
  payload: { fields: string[]; message: string; requestDocument?: boolean },
): Promise<MagicLinkRequest> {
  return publicVerificationRepository.requestClarification(token, payload);
}

export async function updateTeamMemberRole(
  organizationId: string,
  id: string,
  role: Exclude<TeamMember["role"], "owner">,
): Promise<TeamMember | undefined> {
  return institutionRepository.updateTeamMemberRole(organizationId, id, role);
}

export async function suspendTeamMember(
  organizationId: string,
  id: string,
): Promise<TeamMember | undefined> {
  return institutionRepository.suspendTeamMember(organizationId, id);
}

export async function restoreTeamMember(
  organizationId: string,
  id: string,
): Promise<TeamMember | undefined> {
  return institutionRepository.restoreTeamMember(organizationId, id);
}

export async function removeTeamMember(organizationId: string, id: string): Promise<void> {
  return institutionRepository.removeTeamMember(organizationId, id);
}

export async function inviteTeamMember(
  organizationId: string,
  email: string,
  role: TeamInvitation["role"],
) {
  return institutionRepository.inviteTeamMember(organizationId, email, role);
}

export async function resendTeamInvitation(organizationId: string, id: string) {
  return institutionRepository.resendTeamInvitation(organizationId, id);
}

export async function cancelTeamInvitation(organizationId: string, id: string) {
  return institutionRepository.cancelTeamInvitation(organizationId, id);
}

export async function transferTeamOwnership(organizationId: string, id: string) {
  return institutionRepository.transferTeamOwnership(organizationId, id);
}
