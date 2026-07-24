import { institutionAppConfig } from "./config";
import {
  apiNotConfiguredError,
  conflictError,
  notFoundError,
  serviceUnavailableError,
} from "./errors";
import { mockMagicLinks, mockPeople, mockRequests, mockSettings, mockTeam } from "./mock-data";
import type {
  InstitutionSettings,
  MagicLinkRequest,
  Person,
  TeamMember,
  VerificationRequest,
  VerificationStatus,
} from "./types";

interface InstitutionRepository {
  getVerificationRequests: () => Promise<VerificationRequest[]>;
  getVerificationRequest: (id: string) => Promise<VerificationRequest | undefined>;
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
  getPeople: () => Promise<Person[]>;
  getPerson: (id: string) => Promise<Person | undefined>;
  getTeam: () => Promise<TeamMember[]>;
  getSettings: () => Promise<InstitutionSettings>;
  updateTeamMember: (id: string, patch: Partial<TeamMember>) => Promise<TeamMember | undefined>;
  removeTeamMember: (id: string) => Promise<void>;
  inviteTeamMember: (email: string, role: TeamMember["role"]) => Promise<TeamMember>;
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
    async getPeople() {
      return delay(cloneFixture(people));
    },
    async getPerson(id) {
      return delay(cloneFixture(people.find((person) => person.id === id)));
    },
    async getTeam() {
      return delay(cloneFixture(team));
    },
    async getSettings() {
      return delay(cloneFixture(settings));
    },
    async updateTeamMember(id, patch) {
      const member = team.find((candidate) => candidate.id === id);
      if (!member) {
        throw notFoundError("This team member could not be found.");
      }

      const nextTeam = team.map((candidate) =>
        candidate.id === id ? { ...candidate, ...patch } : candidate,
      );
      const activeOwners = nextTeam.filter(
        (candidate) => candidate.role === "owner" && candidate.status === "active",
      );
      if (activeOwners.length === 0) {
        throw conflictError("The final active Owner cannot be removed or suspended.");
      }

      team = nextTeam;
      return delay(cloneFixture(team.find((candidate) => candidate.id === id)));
    },
    async removeTeamMember(id) {
      const member = team.find((candidate) => candidate.id === id);
      if (!member) {
        throw notFoundError("This team member could not be found.");
      }

      const nextTeam = team.filter((candidate) => candidate.id !== id);
      const activeOwners = nextTeam.filter(
        (candidate) => candidate.role === "owner" && candidate.status === "active",
      );
      if (member.role === "owner" && member.status === "active" && activeOwners.length === 0) {
        throw conflictError("The final active Owner cannot be removed or suspended.");
      }

      team = nextTeam;
      return delay(undefined);
    },
    async inviteTeamMember(email, role) {
      const member: TeamMember = {
        id: `member_${Date.now()}`,
        name: email.split("@")[0],
        email,
        role,
        status: "pending",
      };
      team = [...team, member];
      return delay(cloneFixture(member));
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
    async respondToVerification() {
      assertInstitutionBackend("Verification responses");
    },
    async requestClarification() {
      assertInstitutionBackend("Verification responses");
    },
    async addInternalNote() {
      assertInstitutionBackend("Internal verification notes");
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
    async updateTeamMember() {
      assertInstitutionBackend("Institution team management");
    },
    async removeTeamMember() {
      assertInstitutionBackend("Institution team management");
    },
    async inviteTeamMember() {
      assertInstitutionBackend("Institution team management");
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
  : unavailableInstitutionRepository();
const publicVerificationRepository = institutionAppConfig.demoMode
  ? demoPublicVerificationRepository()
  : unavailablePublicVerificationRepository();

export async function getInstitutionVerificationRequests(): Promise<VerificationRequest[]> {
  return institutionRepository.getVerificationRequests();
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
  assertDemoMode("Verification responses");
  return institutionRepository.respondToVerification(id, action, payload);
}

export async function requestInstitutionClarification(
  id: string,
  payload: { fields: string[]; message: string; requestDocument?: boolean },
): Promise<VerificationRequest | undefined> {
  assertDemoMode("Verification responses");
  return institutionRepository.requestClarification(id, payload);
}

export async function addInternalNote(
  id: string,
  author: string,
  body: string,
): Promise<VerificationRequest | undefined> {
  assertDemoMode("Internal verification notes");
  return institutionRepository.addInternalNote(id, author, body);
}

export async function getInstitutionPeople(): Promise<Person[]> {
  return institutionRepository.getPeople();
}

export async function getInstitutionPerson(id: string): Promise<Person | undefined> {
  return institutionRepository.getPerson(id);
}

export async function getInstitutionTeam(): Promise<TeamMember[]> {
  return institutionRepository.getTeam();
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

export async function updateTeamMember(
  id: string,
  patch: Partial<TeamMember>,
): Promise<TeamMember | undefined> {
  assertDemoMode("Institution team management");
  return institutionRepository.updateTeamMember(id, patch);
}

export async function removeTeamMember(id: string): Promise<void> {
  assertDemoMode("Institution team management");
  return institutionRepository.removeTeamMember(id);
}

export async function inviteTeamMember(email: string, role: TeamMember["role"]) {
  assertDemoMode("Institution team management");
  return institutionRepository.inviteTeamMember(email, role);
}
