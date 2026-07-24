import { institutionAppConfig } from "./config";
import { apiNotConfiguredError } from "./errors";
import type { Session } from "./types";

export type InstitutionType =
  | "University"
  | "College"
  | "School"
  | "Training Institute"
  | "Certification Body"
  | "Other Educational Institution";

export type VerificationMethod = "email" | "domain" | "manual";

export type EmailVerificationStatus = "not_started" | "code_sent" | "verified" | "failed";

export type WorkspaceApplicationStatus =
  | "draft"
  | "email_verification_required"
  | "verification_pending"
  | "additional_information_required"
  | "approved"
  | "rejected";

export interface InstitutionDetails {
  name: string;
  type: InstitutionType | "";
  website: string;
  domain: string;
  country: string;
  city: string;
  verificationEmail: string;
}

export interface InstitutionAdministrator {
  fullName: string;
  jobTitle: string;
  workEmail: string;
  phone?: string;
  password: string;
  confirmPassword: string;
  authorized: boolean;
}

export interface InstitutionVerification {
  method: VerificationMethod;
  emailStatus: EmailVerificationStatus;
  emailCode?: string;
  domainDetected?: boolean;
  manualNote?: string;
}

export interface InstitutionSignupDraft {
  id: string;
  institution: InstitutionDetails;
  administrator: InstitutionAdministrator;
  verification: InstitutionVerification;
  acceptedTerms: boolean;
  acceptedPrivacy: boolean;
  acceptedAuthority: boolean;
  updatedAt: string;
}

export interface WorkspaceApplication {
  id: string;
  status: WorkspaceApplicationStatus;
  submittedAt: string;
  institution: InstitutionDetails;
  administrator: Omit<InstitutionAdministrator, "password" | "confirmPassword">;
  verification: InstitutionVerification;
}

interface PersistedInstitutionAdministrator {
  fullName: string;
  jobTitle: string;
  workEmail: string;
  phone?: string;
  authorized: boolean;
}

interface PersistedInstitutionVerification {
  method: VerificationMethod;
  emailStatus: EmailVerificationStatus;
  domainDetected?: boolean;
}

interface PersistedInstitutionSignupDraft {
  id: string;
  institution: InstitutionDetails;
  administrator: PersistedInstitutionAdministrator;
  verification: PersistedInstitutionVerification;
  acceptedTerms: boolean;
  acceptedPrivacy: boolean;
  acceptedAuthority: boolean;
  updatedAt: string;
}

const DRAFT_KEY = "kairo.institution.signup.draft";
const APPLICATION_KEY = "kairo.institution.signup.application";
const DEMO_SESSION_KEY = "kairo.institution.demo.session";

const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "icloud.com",
  "protonmail.com",
  "aol.com",
  "live.com",
  "me.com",
]);

let volatileAdministratorSecrets: Pick<
  InstitutionAdministrator,
  "password" | "confirmPassword"
> | null = null;
let volatileVerificationDraft: Pick<InstitutionVerification, "emailCode" | "manualNote"> | null =
  null;

export function isPersonalEmailDomain(email: string): boolean {
  const at = email.trim().toLowerCase().split("@")[1];
  if (!at) return false;
  return PERSONAL_EMAIL_DOMAINS.has(at);
}

export function extractDomain(email: string): string {
  return email.trim().toLowerCase().split("@")[1] ?? "";
}

function emptyDraft(): InstitutionSignupDraft {
  return {
    id: `draft_${Date.now()}`,
    institution: {
      name: "",
      type: "",
      website: "",
      domain: "",
      country: "",
      city: "",
      verificationEmail: "",
    },
    administrator: {
      fullName: "",
      jobTitle: "",
      workEmail: "",
      phone: "",
      password: "",
      confirmPassword: "",
      authorized: false,
    },
    verification: {
      method: "email",
      emailStatus: "not_started",
    },
    acceptedTerms: false,
    acceptedPrivacy: false,
    acceptedAuthority: false,
    updatedAt: new Date().toISOString(),
  };
}

function safeRead<T>(key: string): T | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function safeWrite(key: string, value: unknown) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Best effort only for local drafts.
  }
}

function toPersistedDraft(draft: InstitutionSignupDraft): PersistedInstitutionSignupDraft {
  const {
    password: _password,
    confirmPassword: _confirmPassword,
    ...administrator
  } = draft.administrator;
  const { emailCode: _emailCode, manualNote: _manualNote, ...verification } = draft.verification;

  return {
    id: draft.id,
    institution: draft.institution,
    administrator,
    verification,
    acceptedTerms: draft.acceptedTerms,
    acceptedPrivacy: draft.acceptedPrivacy,
    acceptedAuthority: draft.acceptedAuthority,
    updatedAt: draft.updatedAt,
  };
}

function hydrateDraft(
  value: PersistedInstitutionSignupDraft | null,
): InstitutionSignupDraft | null {
  if (!value) return null;

  return {
    ...value,
    administrator: {
      ...value.administrator,
      password: volatileAdministratorSecrets?.password ?? "",
      confirmPassword: volatileAdministratorSecrets?.confirmPassword ?? "",
    },
    verification: {
      ...value.verification,
      emailCode: volatileVerificationDraft?.emailCode,
      manualNote: volatileVerificationDraft?.manualNote,
    },
  };
}

function clearVolatileSignupState() {
  volatileAdministratorSecrets = null;
  volatileVerificationDraft = null;
}

export function getInstitutionSignupDraft(): InstitutionSignupDraft | null {
  return hydrateDraft(safeRead<PersistedInstitutionSignupDraft>(DRAFT_KEY));
}

export function createInstitutionSignupDraft(): InstitutionSignupDraft {
  const existing = getInstitutionSignupDraft();
  if (existing) return existing;

  const draft = emptyDraft();
  safeWrite(DRAFT_KEY, toPersistedDraft(draft));
  return draft;
}

function persistDraft(draft: InstitutionSignupDraft): InstitutionSignupDraft {
  const next = { ...draft, updatedAt: new Date().toISOString() };
  safeWrite(DRAFT_KEY, toPersistedDraft(next));
  return next;
}

export function updateInstitutionDetails(
  patch: Partial<InstitutionDetails>,
): InstitutionSignupDraft {
  const current = getInstitutionSignupDraft() ?? emptyDraft();
  return persistDraft({
    ...current,
    institution: { ...current.institution, ...patch },
  });
}

export function updateInstitutionAdministrator(
  patch: Partial<InstitutionAdministrator>,
): InstitutionSignupDraft {
  const current = getInstitutionSignupDraft() ?? emptyDraft();

  volatileAdministratorSecrets = {
    password: patch.password ?? current.administrator.password,
    confirmPassword: patch.confirmPassword ?? current.administrator.confirmPassword,
  };

  return persistDraft({
    ...current,
    administrator: {
      ...current.administrator,
      ...patch,
    },
  });
}

export function updateInstitutionVerification(
  patch: Partial<InstitutionVerification>,
): InstitutionSignupDraft {
  const current = getInstitutionSignupDraft() ?? emptyDraft();

  volatileVerificationDraft = {
    emailCode: patch.emailCode ?? current.verification.emailCode,
    manualNote: patch.manualNote ?? current.verification.manualNote,
  };

  return persistDraft({
    ...current,
    verification: {
      ...current.verification,
      ...patch,
    },
  });
}

export function updateSignupAcknowledgements(patch: {
  acceptedTerms?: boolean;
  acceptedPrivacy?: boolean;
  acceptedAuthority?: boolean;
}): InstitutionSignupDraft {
  const current = getInstitutionSignupDraft() ?? emptyDraft();
  return persistDraft({ ...current, ...patch });
}

export async function requestInstitutionEmailVerification(): Promise<{
  ok: true;
  sentTo: string;
}> {
  if (!institutionAppConfig.demoMode) {
    throw apiNotConfiguredError("Institution signup email verification");
  }

  const current = getInstitutionSignupDraft() ?? emptyDraft();
  const next = persistDraft({
    ...current,
    verification: {
      ...current.verification,
      method: "email",
      emailStatus: "code_sent",
    },
  });

  return { ok: true, sentTo: next.institution.verificationEmail };
}

export async function verifyInstitutionEmailCode(
  code: string,
): Promise<{ ok: boolean; status: EmailVerificationStatus }> {
  if (!institutionAppConfig.demoMode) {
    throw apiNotConfiguredError("Institution signup email verification");
  }

  const current = getInstitutionSignupDraft() ?? emptyDraft();
  const ok = /^\d{6}$/.test(code.trim());
  const status: EmailVerificationStatus = ok ? "verified" : "failed";
  persistDraft({
    ...current,
    verification: {
      ...current.verification,
      emailStatus: status,
      emailCode: code,
    },
  });

  return { ok, status };
}

export async function submitInstitutionWorkspaceApplication(): Promise<WorkspaceApplication> {
  if (!institutionAppConfig.demoMode) {
    throw apiNotConfiguredError("Institution workspace signup");
  }

  const draft = getInstitutionSignupDraft() ?? emptyDraft();
  const {
    password: _password,
    confirmPassword: _confirmPassword,
    ...administrator
  } = draft.administrator;
  const status: WorkspaceApplicationStatus =
    draft.verification.method === "email" && draft.verification.emailStatus === "verified"
      ? "verification_pending"
      : draft.verification.method === "manual" || draft.verification.method === "domain"
        ? "verification_pending"
        : "email_verification_required";

  const application: WorkspaceApplication = {
    id: `app_${Date.now()}`,
    status,
    submittedAt: new Date().toISOString(),
    institution: draft.institution,
    administrator,
    verification: {
      ...draft.verification,
      emailCode: undefined,
      manualNote: volatileVerificationDraft?.manualNote,
    },
  };

  safeWrite(APPLICATION_KEY, application);

  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore cleanup failures
    }
  }

  clearVolatileSignupState();
  return application;
}

export function getInstitutionWorkspaceApplication(): WorkspaceApplication | null {
  return safeRead<WorkspaceApplication>(APPLICATION_KEY);
}

export function statusLabel(status: WorkspaceApplicationStatus): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "email_verification_required":
      return "Email Verification Required";
    case "verification_pending":
      return "Verification Pending";
    case "additional_information_required":
      return "Additional Information Required";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
  }
}

export function createMockApprovedInstitutionSession(input: {
  name: string;
  email: string;
  institutionName: string;
}): void {
  if (!institutionAppConfig.demoMode || typeof window === "undefined") {
    throw apiNotConfiguredError("Institution workspace preview");
  }

  const session: Session = {
    userId: `u_demo_${Date.now()}`,
    membershipId: `membership_demo_${Date.now()}`,
    institutionId: `inst_demo_${Date.now()}`,
    name: input.name || "Institution Admin",
    email: input.email || "admin@example.edu",
    role: "owner",
    institutionName: input.institutionName || "Your Institution",
    accountStatus: "active",
    workspaceStatus: "active",
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
  };

  window.sessionStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(session));
}
