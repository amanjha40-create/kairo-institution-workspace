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
  InstitutionTeam,
  InstitutionWorkspaceBootstrap,
  TeamInvitation,
  TeamMember,
} from "./types";

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
