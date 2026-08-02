import {
  completeInstitutionWorkspaceOnboarding,
  completeOrganizationStaffSignup,
  getStoredInstitutionAuthTokens,
  refreshInstitutionUserSession,
  sendOrganizationStaffSignupEmail,
  startOrganizationStaffSignup,
  storeInstitutionAuthTokens,
  verifyOrganizationStaffSignupEmail,
} from "./backend";
import { institutionAppConfig } from "./config";
import { apiNotConfiguredError, validationError } from "./errors";

const DEMO_BUILD = import.meta.env.VITE_DEMO_MODE === "true";
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
  manualNote?: string;
  signupSessionId?: string;
  emailMasked?: string;
  resendAfterSeconds?: number;
  expiresInSeconds?: number;
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
  signupSessionId?: string;
  emailMasked?: string;
  resendAfterSeconds?: number;
  expiresInSeconds?: number;
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

function persistDraft(draft: InstitutionSignupDraft): InstitutionSignupDraft {
  const next = { ...draft, updatedAt: new Date().toISOString() };
  safeWrite(DRAFT_KEY, toPersistedDraft(next));
  return next;
}

function buildApplication(
  draft: InstitutionSignupDraft,
  status: WorkspaceApplicationStatus,
): WorkspaceApplication {
  const {
    password: _password,
    confirmPassword: _confirmPassword,
    ...administrator
  } = draft.administrator;

  return {
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
}

async function resolveAccessTokenForOnboarding(draft: InstitutionSignupDraft) {
  const stored = getStoredInstitutionAuthTokens();
  if (stored) {
    if (new Date(stored.expiresAt).getTime() <= Date.now()) {
      const refreshed = await refreshInstitutionUserSession(stored.refreshToken);
      return refreshed.accessToken;
    }

    return stored.accessToken;
  }

  if (!draft.verification.signupSessionId || draft.verification.emailStatus !== "verified") {
    throw validationError("Verify the administrator work email before continuing.");
  }

  const tokens = await completeOrganizationStaffSignup(draft.verification.signupSessionId);
  storeInstitutionAuthTokens(tokens);
  return tokens.accessToken;
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
  if (DEMO_BUILD) {
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

  if (!institutionAppConfig.backendConfigured) {
    throw apiNotConfiguredError("Institution signup email verification");
  }

  const current = getInstitutionSignupDraft() ?? emptyDraft();
  if (
    !current.administrator.fullName.trim() ||
    !current.administrator.workEmail.trim() ||
    !current.administrator.password.trim()
  ) {
    throw validationError(
      "Return to the administrator step and complete the required details before verifying the work email.",
    );
  }

  const signupSessionId = current.verification.signupSessionId;
  const emailMasked = current.verification.emailMasked ?? current.administrator.workEmail;

  if (!signupSessionId) {
    const started = await startOrganizationStaffSignup({
      fullName: current.administrator.fullName,
      workEmail: current.administrator.workEmail,
      password: current.administrator.password,
    });
    persistDraft({
      ...current,
      verification: {
        ...current.verification,
        method: "email",
        emailStatus: started.emailVerified ? "verified" : "code_sent",
        signupSessionId: started.signupSessionId,
        emailMasked: started.emailMasked || emailMasked,
        resendAfterSeconds: started.resendAfterSeconds,
        expiresInSeconds: started.expiresInSeconds,
      },
    });

    return {
      ok: true,
      sentTo: started.emailMasked || emailMasked,
    };
  }

  const sent = await sendOrganizationStaffSignupEmail(signupSessionId);

  persistDraft({
    ...current,
    verification: {
      ...current.verification,
      method: "email",
      emailStatus: sent.emailVerified ? "verified" : "code_sent",
      signupSessionId: sent.signupSessionId,
      emailMasked: sent.emailMasked || emailMasked,
      resendAfterSeconds: sent.resendAfterSeconds,
      expiresInSeconds: sent.expiresInSeconds,
    },
  });

  return {
    ok: true,
    sentTo: sent.emailMasked || emailMasked,
  };
}

export async function verifyInstitutionEmailCode(
  code: string,
): Promise<{ ok: boolean; status: EmailVerificationStatus }> {
  if (DEMO_BUILD) {
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

  if (!institutionAppConfig.backendConfigured) {
    throw apiNotConfiguredError("Institution signup email verification");
  }

  const current = getInstitutionSignupDraft() ?? emptyDraft();
  if (!current.verification.signupSessionId) {
    throw validationError("Send a verification code before attempting to verify it.");
  }

  const verified = await verifyOrganizationStaffSignupEmail(
    current.verification.signupSessionId,
    code.trim(),
  );
  const status: EmailVerificationStatus = verified.emailVerified ? "verified" : "failed";

  persistDraft({
    ...current,
    verification: {
      ...current.verification,
      emailStatus: status,
      emailCode: code.trim(),
    },
  });

  return { ok: verified.emailVerified, status };
}

export async function submitInstitutionWorkspaceApplication(): Promise<WorkspaceApplication> {
  const draft = getInstitutionSignupDraft() ?? emptyDraft();

  if (DEMO_BUILD) {
    const status: WorkspaceApplicationStatus =
      draft.verification.method === "email" && draft.verification.emailStatus === "verified"
        ? "verification_pending"
        : draft.verification.method === "manual" || draft.verification.method === "domain"
          ? "verification_pending"
          : "email_verification_required";

    const application = buildApplication(draft, status);
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

  if (!institutionAppConfig.backendConfigured) {
    throw apiNotConfiguredError("Institution workspace signup");
  }

  const accessToken = await resolveAccessTokenForOnboarding(draft);
  await completeInstitutionWorkspaceOnboarding(accessToken, {
    name: draft.institution.name,
    website: draft.institution.website || undefined,
    location:
      [draft.institution.city, draft.institution.country].filter(Boolean).join(", ") || undefined,
    workEmail: draft.institution.verificationEmail || draft.administrator.workEmail || undefined,
    domain: draft.institution.domain || undefined,
  });

  const application = buildApplication(draft, "verification_pending");
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
