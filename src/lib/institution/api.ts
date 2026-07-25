import { institutionAppConfig } from "./config";
import {
  assignInstitutionVerificationReviewer,
  cancelInstitutionOrganizationInvitation,
  createInstitutionOrganizationInvitation,
  getInstitutionOrganizationVerificationRequests as fetchInstitutionOrganizationVerificationRequests,
  getInstitutionOrganizationTeam,
  getInstitutionVerificationEvidence,
  getInstitutionVerificationRequestDetail,
  getInstitutionVerificationTimeline,
  removeInstitutionOrganizationMember,
  rejectInstitutionVerificationRequest,
  resendInstitutionOrganizationInvitation,
  restoreInstitutionOrganizationMember,
  suspendInstitutionOrganizationMember,
  transferInstitutionOrganizationOwnership,
  updateInstitutionVerificationInternalNote,
  updateInstitutionOrganizationMemberRole,
  verifyInstitutionVerificationRequest,
  requestInstitutionVerificationInformation,
} from "./backend";
import {
  apiNotConfiguredError,
  conflictError,
  forbiddenError,
  notFoundError,
  serviceUnavailableError,
  unauthorizedError,
} from "./errors";
import { mockMagicLinks, mockPeople, mockRequests, mockSettings, mockTeam } from "./mock-data";
import type {
  EvidenceFile,
  InstitutionTeam,
  InstitutionSettings,
  InternalNote,
  MagicLinkRequest,
  Person,
  TeamInvitation,
  TeamMember,
  TimelineEvent,
  VerificationRequest,
  VerificationStatus,
} from "./types";

interface InstitutionRepository {
  getVerificationRequests: (organizationId: string) => Promise<VerificationRequest[]>;
  getVerificationRequest: (id: string) => Promise<VerificationRequest | undefined>;
  getVerificationEvidence: (id: string) => Promise<EvidenceFile[]>;
  getVerificationTimeline: (id: string) => Promise<TimelineEvent[]>;
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
  getPeople: () => Promise<Person[]>;
  getPerson: (id: string) => Promise<Person | undefined>;
  getTeam: (organizationId: string) => Promise<InstitutionTeam>;
  getSettings: () => Promise<InstitutionSettings>;
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

const requests: VerificationRequest[] = cloneFixture(mockRequests);
const people: Person[] = cloneFixture(mockPeople);
let team: TeamMember[] = cloneFixture(mockTeam);
const settings: InstitutionSettings = cloneFixture(mockSettings);
const magicLinks = cloneFixture(mockMagicLinks);

function getDemoTeamMembers() {
  return team.filter((member) => member.status !== "pending");
}

function getDemoTeamInvitations(): TeamInvitation[] {
  return team
    .filter((member) => member.status === "pending")
    .map((member) => ({
      id: member.id,
      email: member.email,
      role: member.role === "owner" ? "reviewer" : member.role,
      status: "pending" as const,
      invitedByEmail: mockTeam[0]?.email ?? null,
      invitedByName: mockTeam[0]?.name ?? null,
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

function findRequestIndex(id: string) {
  return requests.findIndex((request) => request.id === id);
}

function assertMutableRequest(id: string) {
  const idx = findRequestIndex(id);
  if (idx === -1) {
    throw notFoundError("This verification request could not be found.");
  }

  const request = requests[idx];
  if (["confirmed", "discrepancy", "closed"].includes(request.status)) {
    throw conflictError("This verification request has already been completed.");
  }

  return { idx, request };
}

function assertMagicLinkUsable(token: string) {
  const record = magicLinks[token];
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
    async getVerificationRequests() {
      return delay(cloneFixture(requests));
    },
    async getVerificationRequest(id) {
      return delay(cloneFixture(requests.find((request) => request.id === id)));
    },
    async getVerificationEvidence(id) {
      const request = requests.find((candidate) => candidate.id === id);
      if (!request) {
        throw notFoundError("This verification request could not be found.");
      }

      return delay(cloneFixture(request.evidence));
    },
    async getVerificationTimeline(id) {
      const request = requests.find((candidate) => candidate.id === id);
      if (!request) {
        throw notFoundError("This verification request could not be found.");
      }

      return delay(cloneFixture(request.timeline));
    },
    async respondToVerification(id, action, payload) {
      const { idx } = assertMutableRequest(id);
      const now = new Date().toISOString();
      const status: VerificationStatus = action === "confirm" ? "confirmed" : "discrepancy";
      const label = action === "confirm" ? "Verification confirmed" : "Discrepancy reported";

      requests[idx] = {
        ...requests[idx],
        status,
        timeline: [
          ...requests[idx].timeline,
          {
            id: `timeline_${Date.now()}`,
            at: now,
            label,
            detail: payload.note ?? payload.reason,
          },
        ],
      };

      return delay(cloneFixture(requests[idx]));
    },
    async requestClarification(id, payload) {
      const { idx } = assertMutableRequest(id);
      const now = new Date().toISOString();

      requests[idx] = {
        ...requests[idx],
        status: "awaiting_clarification",
        timeline: [
          ...requests[idx].timeline,
          {
            id: `timeline_${Date.now()}`,
            at: now,
            label: "Clarification requested",
            detail: payload.fields.join(", "),
          },
        ],
      };

      return delay(cloneFixture(requests[idx]));
    },
    async addInternalNote(id, author, body) {
      const idx = findRequestIndex(id);
      if (idx === -1) {
        throw notFoundError("This verification request could not be found.");
      }

      requests[idx] = {
        ...requests[idx],
        internalNotes: [
          ...requests[idx].internalNotes,
          {
            id: `note_${Date.now()}`,
            author,
            body,
            createdAt: new Date().toISOString(),
          },
        ],
      };

      return delay(cloneFixture(requests[idx]));
    },
    async assignVerificationReviewer(requestId, organizationMemberId) {
      const idx = findRequestIndex(requestId);
      if (idx === -1) {
        throw notFoundError("This verification request could not be found.");
      }

      const assignee = team.find(
        (candidate) =>
          candidate.id === organizationMemberId &&
          candidate.status === "active" &&
          candidate.role !== "member",
      );

      requests[idx] = {
        ...requests[idx],
        assignedTo: assignee?.name,
        timeline: [
          ...requests[idx].timeline,
          {
            id: `timeline_${Date.now()}`,
            at: new Date().toISOString(),
            label: "Reviewer assigned",
            detail: assignee?.name ?? "Assignment cleared",
          },
        ],
      };

      return delay(cloneFixture(requests[idx]));
    },
    async getPeople() {
      return delay(cloneFixture(people));
    },
    async getPerson(id) {
      return delay(cloneFixture(people.find((person) => person.id === id)));
    },
    async getTeam() {
      return delay(
        cloneFixture({
          members: getDemoTeamMembers(),
          invitations: getDemoTeamInvitations(),
        }),
      );
    },
    async getSettings() {
      return delay(cloneFixture(settings));
    },
    async inviteTeamMember(_organizationId, email, role) {
      assertTeamManageable();
      const invitation: TeamMember = {
        id: `invite_${Date.now()}`,
        name: email.split("@")[0],
        email,
        role,
        status: "pending",
      };
      team = [...team, invitation];
      const createdInvitation = getDemoTeamInvitations().find(
        (candidate) => candidate.id === invitation.id,
      );
      if (!createdInvitation) {
        throw notFoundError("This invitation could not be created.");
      }

      return delay(cloneFixture(createdInvitation));
    },
    async resendTeamInvitation(_organizationId, id) {
      const invitation = getDemoTeamInvitations().find((candidate) => candidate.id === id);
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
      const invitation = team.find(
        (candidate) => candidate.id === id && candidate.status === "pending",
      );
      if (!invitation) {
        throw notFoundError("This invitation could not be found.");
      }

      team = team.filter((candidate) => candidate.id !== id);
      return delay(
        cloneFixture({
          id,
          email: invitation.email,
          role: invitation.role === "owner" ? "reviewer" : invitation.role,
          status: "cancelled" as const,
          invitedByEmail: mockTeam[0]?.email ?? null,
          invitedByName: mockTeam[0]?.name ?? null,
          invitedAt: new Date("2026-07-20T09:00:00Z").toISOString(),
          expiresAt: new Date("2026-07-27T09:00:00Z").toISOString(),
          acceptedAt: null,
          declinedAt: null,
          cancelledAt: new Date().toISOString(),
        }),
      );
    },
    async updateTeamMemberRole(_organizationId, id, role) {
      const member = team.find((candidate) => candidate.id === id);
      if (!member) {
        throw notFoundError("This team member could not be found.");
      }
      assertProtectedTeamRole(role);
      if (member.role === "owner") {
        throw forbiddenError("Owner changes must use the dedicated ownership transfer flow.");
      }

      const nextTeam = team.map((candidate) =>
        candidate.id === id ? { ...candidate, role } : candidate,
      );

      team = nextTeam;
      return delay(cloneFixture(team.find((candidate) => candidate.id === id)));
    },
    async suspendTeamMember(_organizationId, id) {
      const member = team.find((candidate) => candidate.id === id);
      if (!member) {
        throw notFoundError("This team member could not be found.");
      }

      const nextTeam = team.map((candidate) =>
        candidate.id === id ? { ...candidate, status: "suspended" as const } : candidate,
      );
      assertFinalOwnerStillActive(nextTeam);
      team = nextTeam;
      return delay(cloneFixture(team.find((candidate) => candidate.id === id)));
    },
    async restoreTeamMember(_organizationId, id) {
      const member = team.find((candidate) => candidate.id === id);
      if (!member) {
        throw notFoundError("This team member could not be found.");
      }

      team = team.map((candidate) =>
        candidate.id === id ? { ...candidate, status: "active" as const } : candidate,
      );
      return delay(cloneFixture(team.find((candidate) => candidate.id === id)));
    },
    async removeTeamMember(_organizationId, id) {
      const member = team.find((candidate) => candidate.id === id);
      if (!member) {
        throw notFoundError("This team member could not be found.");
      }

      const nextTeam = team.filter((candidate) => candidate.id !== id);
      if (member.role === "owner" && member.status === "active") {
        assertFinalOwnerStillActive(nextTeam);
      }

      team = nextTeam;
      return delay(undefined);
    },
    async transferTeamOwnership(_organizationId, id) {
      const target = team.find((candidate) => candidate.id === id);
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
      team = team.map((candidate) => {
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
  };
}

function unavailableInstitutionRepository(): InstitutionRepository {
  return {
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
    async getPeople() {
      assertInstitutionBackend("Institution people");
    },
    async getPerson() {
      assertInstitutionBackend("Institution people");
    },
    async getTeam() {
      assertInstitutionBackend("Institution team");
    },
    async getSettings() {
      assertInstitutionBackend("Institution settings");
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
  };
}

function backendInstitutionRepository(): InstitutionRepository {
  const unavailable = unavailableInstitutionRepository();

  return {
    ...unavailable,
    async getVerificationRequests(organizationId) {
      return fetchInstitutionOrganizationVerificationRequests(organizationId);
    },
    async getVerificationRequest(id) {
      return getInstitutionVerificationRequestDetail(id);
    },
    async getVerificationEvidence(id) {
      return getInstitutionVerificationEvidence(id);
    },
    async getVerificationTimeline(id) {
      return getInstitutionVerificationTimeline(id);
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
    async getTeam(organizationId) {
      return getInstitutionOrganizationTeam(organizationId);
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
  };
}

function demoPublicVerificationRepository(): PublicVerificationRepository {
  return {
    async getByToken(token) {
      return delay(cloneFixture(magicLinks[token] ?? { state: "invalid" }));
    },
    async confirm(token, note) {
      const record = assertMagicLinkUsable(token);
      magicLinks[token] = {
        ...record,
        state: "completed",
      };
      return delay(
        cloneFixture({
          ...magicLinks[token],
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
      const record = assertMagicLinkUsable(token);
      magicLinks[token] = {
        ...record,
        state: "completed",
      };
      return delay(cloneFixture(magicLinks[token]));
    },
    async requestClarification(token) {
      const record = assertMagicLinkUsable(token);
      magicLinks[token] = {
        ...record,
        state: "completed",
      };
      return delay(cloneFixture(magicLinks[token]));
    },
  };
}

function unavailablePublicVerificationRepository(): PublicVerificationRepository {
  return {
    async getByToken() {
      assertInstitutionBackend("Magic-link verification");
    },
    async confirm() {
      assertInstitutionBackend("Magic-link verification");
    },
    async reportDiscrepancy() {
      assertInstitutionBackend("Magic-link verification");
    },
    async requestClarification() {
      assertInstitutionBackend("Magic-link verification");
    },
  };
}

const institutionRepository = institutionAppConfig.demoMode
  ? demoInstitutionRepository()
  : backendInstitutionRepository();
const publicVerificationRepository = institutionAppConfig.demoMode
  ? demoPublicVerificationRepository()
  : unavailablePublicVerificationRepository();

export async function getInstitutionVerificationRequests(
  organizationId: string,
): Promise<VerificationRequest[]> {
  return institutionRepository.getVerificationRequests(organizationId);
}

export async function getInstitutionVerificationRequest(
  id: string,
): Promise<VerificationRequest | undefined> {
  return institutionRepository.getVerificationRequest(id);
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
): Promise<VerificationRequest[]> {
  return institutionRepository.getVerificationRequests(organizationId);
}

export async function getInstitutionVerificationEvidenceItems(id: string): Promise<EvidenceFile[]> {
  return institutionRepository.getVerificationEvidence(id);
}

export async function getInstitutionVerificationTimelineItems(
  id: string,
): Promise<TimelineEvent[]> {
  return institutionRepository.getVerificationTimeline(id);
}

export async function assignInstitutionVerificationRequestReviewer(
  requestId: string,
  organizationMemberId?: string,
): Promise<VerificationRequest | undefined> {
  return institutionRepository.assignVerificationReviewer(requestId, organizationMemberId);
}

export async function getInstitutionPeople(): Promise<Person[]> {
  return institutionRepository.getPeople();
}

export async function getInstitutionPerson(id: string): Promise<Person | undefined> {
  return institutionRepository.getPerson(id);
}

export async function getInstitutionTeam(organizationId: string): Promise<InstitutionTeam> {
  return institutionRepository.getTeam(organizationId);
}

export async function getInstitutionSettings(): Promise<InstitutionSettings> {
  return institutionRepository.getSettings();
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
  assertDemoMode("Magic-link verification");
  return publicVerificationRepository.confirm(token, payload.note);
}

export async function reportPublicInstitutionVerificationDiscrepancy(
  token: string,
  payload: { fields: string[]; explanation: string },
): Promise<MagicLinkRequest> {
  assertDemoMode("Magic-link verification");
  return publicVerificationRepository.reportDiscrepancy(token, payload);
}

export async function requestPublicInstitutionVerificationClarification(
  token: string,
  payload: { fields: string[]; message: string; requestDocument?: boolean },
): Promise<MagicLinkRequest> {
  assertDemoMode("Magic-link verification");
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
