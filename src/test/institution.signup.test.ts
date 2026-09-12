import { describe, expect, it, vi } from "vitest";

function noOrgBootstrap() {
  return {
    state: "no_org" as const,
    currentUser: {
      id: "user_001",
      email: "owner@example.edu",
      fullName: "Existing Owner",
      role: "user",
      activeOrganizationPublicId: null,
    },
    activeOrganization: null,
    membershipRole: null,
    organizationVerificationState: null,
    organizationSuspended: false,
    membershipSuspended: false,
    setupCompleted: false,
    permissionFlags: {
      inviteCandidate: false,
      modifyPerson: false,
      modifyInvitation: false,
      modifyVerification: false,
      manageTeam: false,
      saveSettings: false,
      transferOwnership: false,
    },
  };
}

function employerBootstrap() {
  return {
    ...noOrgBootstrap(),
    state: "ready" as const,
    currentUser: {
      ...noOrgBootstrap().currentUser,
      activeOrganizationPublicId: "org_employer",
    },
    activeOrganization: {
      publicId: "org_employer",
      name: "Example Employer",
      organizationType: "employer",
      website: "https://employer.example",
      location: "Delhi, India",
      workEmail: "owner@example.edu",
      domain: "employer.example",
      verificationState: "verified" as const,
      setupCompletedAt: "2026-09-01T00:00:00.000Z",
      suspendedAt: null,
    },
    membershipRole: "owner" as const,
    organizationVerificationState: "verified" as const,
    setupCompleted: true,
  };
}

async function importSignupModule(demoMode: "true" | "false") {
  vi.resetModules();
  vi.stubEnv("VITE_APP_ENV", "test");
  vi.stubEnv("VITE_DEMO_MODE", demoMode);
  vi.stubEnv("VITE_API_BASE_URL", "");
  return import("@/lib/institution/signup");
}

describe("institution signup storage", () => {
  it("maps the selected production institution type to the canonical backend organization type", async () => {
    const completeInstitutionWorkspaceOnboarding = vi.fn().mockResolvedValue({
      publicId: "org_001",
      name: "Founder University",
    });
    const getStoredInstitutionAuthTokens = vi.fn().mockReturnValue({
      accessToken: "access_token_123",
      refreshToken: "refresh_token_123",
      tokenType: "bearer",
      expiresAt: "2099-01-01T00:00:00.000Z",
    });

    vi.resetModules();
    vi.stubEnv("VITE_APP_ENV", "test");
    vi.stubEnv("VITE_DEMO_MODE", "false");
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");

    vi.doMock("@/lib/institution/backend", async () => {
      const actual = await vi.importActual<typeof import("@/lib/institution/backend")>(
        "@/lib/institution/backend",
      );

      return {
        ...actual,
        getStoredInstitutionAuthTokens,
        completeInstitutionWorkspaceOnboarding,
        listCurrentOrganizationMemberships: vi.fn().mockResolvedValue([]),
      };
    });

    const signup = await import("@/lib/institution/signup");

    signup.createInstitutionSignupDraft();
    signup.updateInstitutionDetails({
      name: "Founder University",
      type: "University",
      website: "https://institution.example",
      domain: "institution.example",
      country: "India",
      city: "Delhi",
      verificationEmail: "verification@institution.example",
    });
    signup.updateInstitutionAdministrator({
      fullName: "Aman Jha",
      jobTitle: "Founder",
      workEmail: "aman@institution.example",
      authorized: true,
      password: "super-secret-password",
      confirmPassword: "super-secret-password",
    });
    signup.updateInstitutionVerification({
      method: "email",
      emailStatus: "verified",
    });

    await signup.submitInstitutionWorkspaceApplication();

    expect(completeInstitutionWorkspaceOnboarding).toHaveBeenCalledWith(
      "access_token_123",
      expect.objectContaining({
        name: "Founder University",
        organizationType: "university",
      }),
    );
  });

  it("rejects unsupported institution types before sending the production onboarding payload", async () => {
    const completeInstitutionWorkspaceOnboarding = vi.fn();
    const getStoredInstitutionAuthTokens = vi.fn().mockReturnValue({
      accessToken: "access_token_123",
      refreshToken: "refresh_token_123",
      tokenType: "bearer",
      expiresAt: "2099-01-01T00:00:00.000Z",
    });

    vi.resetModules();
    vi.stubEnv("VITE_APP_ENV", "test");
    vi.stubEnv("VITE_DEMO_MODE", "false");
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");

    vi.doMock("@/lib/institution/backend", async () => {
      const actual = await vi.importActual<typeof import("@/lib/institution/backend")>(
        "@/lib/institution/backend",
      );

      return {
        ...actual,
        getStoredInstitutionAuthTokens,
        completeInstitutionWorkspaceOnboarding,
      };
    });

    const signup = await import("@/lib/institution/signup");

    signup.createInstitutionSignupDraft();
    signup.updateInstitutionDetails({
      name: "Founder College",
      type: "College",
      website: "https://institution.example",
      domain: "institution.example",
      country: "India",
      city: "Delhi",
      verificationEmail: "verification@institution.example",
    });
    signup.updateInstitutionAdministrator({
      fullName: "Aman Jha",
      jobTitle: "Founder",
      workEmail: "aman@institution.example",
      authorized: true,
      password: "super-secret-password",
      confirmPassword: "super-secret-password",
    });
    signup.updateInstitutionVerification({
      method: "email",
      emailStatus: "verified",
    });

    await expect(signup.submitInstitutionWorkspaceApplication()).rejects.toMatchObject({
      uiMessage: "Institution onboarding currently supports university workspaces only.",
    });
    expect(completeInstitutionWorkspaceOnboarding).not.toHaveBeenCalled();
  });

  it("never persists passwords in the signup draft", async () => {
    const signup = await importSignupModule("true");

    signup.createInstitutionSignupDraft();
    signup.updateInstitutionAdministrator({
      fullName: "Priya Menon",
      jobTitle: "Registrar",
      workEmail: "priya.menon@northbridge.edu",
      authorized: true,
      password: "super-secret-password",
      confirmPassword: "super-secret-password",
    });

    const storedDraft = window.localStorage.getItem("kairo.institution.signup.draft");

    expect(storedDraft).toBeTruthy();
    expect(storedDraft).not.toContain("super-secret-password");
    expect(JSON.parse(storedDraft as string).administrator.password).toBeUndefined();
    expect(signup.getInstitutionSignupDraft()?.administrator.password).toBe(
      "super-secret-password",
    );
  });

  it("uses signup start for the initial OTP request without forcing an immediate resend", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_APP_ENV", "test");
    vi.stubEnv("VITE_DEMO_MODE", "false");
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");

    const startOrganizationStaffSignup = vi.fn().mockResolvedValue({
      signupSessionId: "signup_session_001",
      emailMasked: "p***@northbridge.edu",
      emailVerified: false,
      resendAfterSeconds: 60,
      expiresInSeconds: 600,
      message: "Verification code sent.",
    });
    const sendOrganizationStaffSignupEmail = vi.fn();

    vi.doMock("@/lib/institution/backend", async () => {
      const actual = await vi.importActual<typeof import("@/lib/institution/backend")>(
        "@/lib/institution/backend",
      );

      return {
        ...actual,
        startOrganizationStaffSignup,
        sendOrganizationStaffSignupEmail,
      };
    });

    const signup = await import("@/lib/institution/signup");

    signup.createInstitutionSignupDraft();
    signup.updateInstitutionAdministrator({
      fullName: "Priya Menon",
      jobTitle: "Registrar",
      workEmail: "priya.menon@northbridge.edu",
      authorized: true,
      password: "super-secret-password",
      confirmPassword: "super-secret-password",
    });

    await signup.requestInstitutionEmailVerification();

    expect(startOrganizationStaffSignup).toHaveBeenCalledTimes(1);
    expect(sendOrganizationStaffSignupEmail).not.toHaveBeenCalled();
  });

  it.each(["1c67be80-ae74-4a12-bcd2-a1e76f2cd001", "malformed-stale-signup-session"])(
    "clears irrelevant persisted signup session %s for authenticated first-workspace onboarding",
    async (signupSessionId) => {
      const signup = await importSignupModule("false");

      signup.createInstitutionSignupDraft();
      signup.updateInstitutionDetails({
        name: "Internal QA University",
        type: "University",
        website: "https://institution.example",
        domain: "institution.example",
        country: "India",
        city: "Delhi",
        verificationEmail: "verification@institution.example",
      });
      signup.updateInstitutionAdministrator({
        fullName: "Stale Draft Name",
        jobTitle: "Owner",
        workEmail: "stale@example.edu",
        authorized: true,
        password: "super-secret-password",
        confirmPassword: "super-secret-password",
      });
      signup.updateInstitutionVerification({
        method: "email",
        emailStatus: "code_sent",
        signupSessionId,
        emailMasked: "s***@example.edu",
        expiresInSeconds: 600,
        sessionIssuedAt: "2026-09-09T00:00:00.000Z",
      });

      const prepared = signup.prepareAuthenticatedInstitutionOnboarding(noOrgBootstrap());
      const persisted = JSON.parse(
        window.localStorage.getItem("kairo.institution.signup.draft") as string,
      );

      expect(prepared.administrator.fullName).toBe("Existing Owner");
      expect(prepared.administrator.workEmail).toBe("owner@example.edu");
      expect(prepared.administrator.password).toBe("");
      expect(prepared.verification).toEqual({ method: "email", emailStatus: "verified" });
      expect(persisted.verification.signupSessionId).toBeUndefined();
      expect(persisted.verification.emailMasked).toBeUndefined();
      expect(persisted.administrator.password).toBeUndefined();
      expect(prepared.institution.name).toBe("Internal QA University");
    },
  );

  it("uses the authenticated onboarding endpoint without calling organization-signup OTP APIs", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_APP_ENV", "test");
    vi.stubEnv("VITE_DEMO_MODE", "false");
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");

    const completeInstitutionWorkspaceOnboarding = vi.fn().mockResolvedValue({
      publicId: "org_001",
      name: "Internal QA University",
    });
    const startOrganizationStaffSignup = vi.fn();
    const sendOrganizationStaffSignupEmail = vi.fn();
    const completeOrganizationStaffSignup = vi.fn();
    const getStoredInstitutionAuthTokens = vi.fn().mockReturnValue({
      accessToken: "access_token_123",
      refreshToken: "refresh_token_123",
      tokenType: "bearer",
      expiresAt: "2099-01-01T00:00:00.000Z",
    });

    vi.doMock("@/lib/institution/backend", async () => {
      const actual = await vi.importActual<typeof import("@/lib/institution/backend")>(
        "@/lib/institution/backend",
      );
      return {
        ...actual,
        completeInstitutionWorkspaceOnboarding,
        completeOrganizationStaffSignup,
        getStoredInstitutionAuthTokens,
        listCurrentOrganizationMemberships: vi.fn().mockResolvedValue([]),
        sendOrganizationStaffSignupEmail,
        startOrganizationStaffSignup,
      };
    });

    const signup = await import("@/lib/institution/signup");
    signup.createInstitutionSignupDraft();
    signup.updateInstitutionDetails({
      name: "Internal QA University",
      type: "University",
      website: "https://institution.example",
      domain: "institution.example",
      country: "India",
      city: "Delhi",
      verificationEmail: "verification@institution.example",
    });
    signup.updateInstitutionAdministrator({
      jobTitle: "Owner",
      authorized: true,
    });
    signup.prepareAuthenticatedInstitutionOnboarding(noOrgBootstrap());

    await signup.submitInstitutionWorkspaceApplication();

    expect(completeInstitutionWorkspaceOnboarding).toHaveBeenCalledTimes(1);
    expect(completeInstitutionWorkspaceOnboarding).toHaveBeenCalledWith(
      "access_token_123",
      expect.objectContaining({
        name: "Internal QA University",
        organizationType: "university",
      }),
    );
    expect(startOrganizationStaffSignup).not.toHaveBeenCalled();
    expect(sendOrganizationStaffSignupEmail).not.toHaveBeenCalled();
    expect(completeOrganizationStaffSignup).not.toHaveBeenCalled();
  });

  it("creates an additional university organization for an authenticated employer-only account", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_APP_ENV", "test");
    vi.stubEnv("VITE_DEMO_MODE", "false");
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");

    const createInstitutionOrganization = vi.fn().mockResolvedValue({
      publicId: "org_university",
      name: "Authorized University",
    });
    const completeInstitutionWorkspaceOnboarding = vi.fn();
    const startOrganizationStaffSignup = vi.fn();
    const listCurrentOrganizationMemberships = vi.fn().mockResolvedValue([
      {
        publicId: "org_employer",
        name: "Example Employer",
        organizationType: "employer",
        role: "owner",
        setupCompletedAt: "2026-09-01T00:00:00.000Z",
        suspendedAt: null,
      },
    ]);

    vi.doMock("@/lib/institution/backend", async () => {
      const actual = await vi.importActual<typeof import("@/lib/institution/backend")>(
        "@/lib/institution/backend",
      );
      return {
        ...actual,
        createInstitutionOrganization,
        completeInstitutionWorkspaceOnboarding,
        getStoredInstitutionAuthTokens: vi.fn().mockReturnValue({
          accessToken: "access_token_123",
          refreshToken: "refresh_token_123",
          tokenType: "bearer",
          expiresAt: "2099-01-01T00:00:00.000Z",
        }),
        listCurrentOrganizationMemberships,
        startOrganizationStaffSignup,
      };
    });

    const signup = await import("@/lib/institution/signup");
    signup.createInstitutionSignupDraft();
    signup.updateInstitutionDetails({
      name: "Authorized University",
      type: "University",
      website: "https://university.example",
      domain: "university.example",
      country: "India",
      city: "Delhi",
      verificationEmail: "verification@university.example",
    });
    signup.updateInstitutionAdministrator({ jobTitle: "Owner", authorized: true });
    signup.prepareAuthenticatedInstitutionOnboarding(employerBootstrap(), true);

    await signup.submitInstitutionWorkspaceApplication();

    expect(listCurrentOrganizationMemberships).toHaveBeenCalledWith("access_token_123");
    expect(createInstitutionOrganization).toHaveBeenCalledTimes(1);
    expect(createInstitutionOrganization).toHaveBeenCalledWith(
      "access_token_123",
      expect.objectContaining({
        name: "Authorized University",
        organizationType: "university",
      }),
    );
    expect(completeInstitutionWorkspaceOnboarding).not.toHaveBeenCalled();
    expect(startOrganizationStaffSignup).not.toHaveBeenCalled();
  });

  it("fails closed instead of creating a duplicate university organization", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_APP_ENV", "test");
    vi.stubEnv("VITE_DEMO_MODE", "false");
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");

    const createInstitutionOrganization = vi.fn();
    const completeInstitutionWorkspaceOnboarding = vi.fn();
    vi.doMock("@/lib/institution/backend", async () => {
      const actual = await vi.importActual<typeof import("@/lib/institution/backend")>(
        "@/lib/institution/backend",
      );
      return {
        ...actual,
        createInstitutionOrganization,
        completeInstitutionWorkspaceOnboarding,
        getStoredInstitutionAuthTokens: vi.fn().mockReturnValue({
          accessToken: "access_token_123",
          refreshToken: "refresh_token_123",
          tokenType: "bearer",
          expiresAt: "2099-01-01T00:00:00.000Z",
        }),
        listCurrentOrganizationMemberships: vi.fn().mockResolvedValue([
          {
            publicId: "org_university",
            name: "Existing University",
            organizationType: "university",
            role: "owner",
            setupCompletedAt: "2026-09-01T00:00:00.000Z",
            suspendedAt: null,
          },
        ]),
      };
    });

    const signup = await import("@/lib/institution/signup");
    signup.createInstitutionSignupDraft();
    signup.updateInstitutionDetails({
      name: "Duplicate University",
      type: "University",
      website: "https://duplicate.example",
      domain: "duplicate.example",
      country: "India",
      city: "Delhi",
      verificationEmail: "verification@duplicate.example",
    });
    signup.updateInstitutionAdministrator({ jobTitle: "Owner", authorized: true });
    signup.prepareAuthenticatedInstitutionOnboarding(noOrgBootstrap());

    await expect(signup.submitInstitutionWorkspaceApplication()).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(createInstitutionOrganization).not.toHaveBeenCalled();
    expect(completeInstitutionWorkspaceOnboarding).not.toHaveBeenCalled();
  });

  it("preserves the complete email OTP and signup path for a new organization staff account", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_APP_ENV", "test");
    vi.stubEnv("VITE_DEMO_MODE", "false");
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");

    const startOrganizationStaffSignup = vi.fn().mockResolvedValue({
      signupSessionId: "signup_session_new_account",
      emailMasked: "o***@new.example.edu",
      emailVerified: false,
      resendAfterSeconds: 60,
      expiresInSeconds: 600,
      message: "Verification code sent.",
    });
    const sendOrganizationStaffSignupEmail = vi.fn();
    const verifyOrganizationStaffSignupEmail = vi.fn().mockResolvedValue({
      signupSessionId: "signup_session_new_account",
      emailVerified: true,
      message: "Email verified.",
    });
    const completeOrganizationStaffSignup = vi.fn().mockResolvedValue({
      accessToken: "new_account_access_token",
      refreshToken: "new_account_refresh_token",
      tokenType: "bearer",
      expiresAt: "2099-01-01T00:00:00.000Z",
    });
    const completeInstitutionWorkspaceOnboarding = vi.fn().mockResolvedValue({
      publicId: "org_new_account",
      name: "New University",
    });
    const getStoredInstitutionAuthTokens = vi.fn().mockReturnValue(null);

    vi.doMock("@/lib/institution/backend", async () => {
      const actual = await vi.importActual<typeof import("@/lib/institution/backend")>(
        "@/lib/institution/backend",
      );
      return {
        ...actual,
        completeInstitutionWorkspaceOnboarding,
        completeOrganizationStaffSignup,
        getStoredInstitutionAuthTokens,
        listCurrentOrganizationMemberships: vi.fn().mockResolvedValue([]),
        sendOrganizationStaffSignupEmail,
        startOrganizationStaffSignup,
        verifyOrganizationStaffSignupEmail,
      };
    });

    const signup = await import("@/lib/institution/signup");
    signup.createInstitutionSignupDraft();
    signup.updateInstitutionDetails({
      name: "New University",
      type: "University",
      website: "https://new.example.edu",
      domain: "new.example.edu",
      country: "India",
      city: "Delhi",
      verificationEmail: "verification@new.example.edu",
    });
    signup.updateInstitutionAdministrator({
      fullName: "New Owner",
      jobTitle: "Registrar",
      workEmail: "owner@new.example.edu",
      authorized: true,
      password: "super-secret-password",
      confirmPassword: "super-secret-password",
    });

    await signup.requestInstitutionEmailVerification();
    await signup.verifyInstitutionEmailCode("123456");
    await signup.submitInstitutionWorkspaceApplication();

    expect(startOrganizationStaffSignup).toHaveBeenCalledTimes(1);
    expect(sendOrganizationStaffSignupEmail).not.toHaveBeenCalled();
    expect(verifyOrganizationStaffSignupEmail).toHaveBeenCalledWith(
      "signup_session_new_account",
      "123456",
    );
    expect(completeOrganizationStaffSignup).toHaveBeenCalledWith("signup_session_new_account");
    expect(completeInstitutionWorkspaceOnboarding).toHaveBeenCalledWith(
      "new_account_access_token",
      expect.objectContaining({
        name: "New University",
        organizationType: "university",
      }),
    );
  });

  it.each([400, 409, 503])(
    "keeps the safe draft recoverable when authenticated onboarding fails with %s",
    async (status) => {
      vi.resetModules();
      vi.stubEnv("VITE_APP_ENV", "test");
      vi.stubEnv("VITE_DEMO_MODE", "false");
      vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");

      const { InstitutionError } = await import("@/lib/institution/errors");
      const code =
        status === 409 ? "CONFLICT" : status === 400 ? "VALIDATION" : "SERVICE_UNAVAILABLE";
      const completeInstitutionWorkspaceOnboarding = vi.fn().mockRejectedValue(
        new InstitutionError({
          code,
          message: "Onboarding failed",
          uiMessage: "We couldn't complete onboarding.",
          status,
        }),
      );
      const getStoredInstitutionAuthTokens = vi.fn().mockReturnValue({
        accessToken: "access_token_123",
        refreshToken: "refresh_token_123",
        tokenType: "bearer",
        expiresAt: "2099-01-01T00:00:00.000Z",
      });

      vi.doMock("@/lib/institution/backend", async () => {
        const actual = await vi.importActual<typeof import("@/lib/institution/backend")>(
          "@/lib/institution/backend",
        );
        return {
          ...actual,
          completeInstitutionWorkspaceOnboarding,
          getStoredInstitutionAuthTokens,
          listCurrentOrganizationMemberships: vi.fn().mockResolvedValue([]),
        };
      });

      const signup = await import("@/lib/institution/signup");
      signup.createInstitutionSignupDraft();
      signup.updateInstitutionDetails({
        name: "Internal QA University",
        type: "University",
        website: "https://institution.example",
        domain: "institution.example",
        country: "India",
        city: "Delhi",
        verificationEmail: "verification@institution.example",
      });
      signup.updateInstitutionAdministrator({ jobTitle: "Owner", authorized: true });
      signup.prepareAuthenticatedInstitutionOnboarding(noOrgBootstrap());

      await expect(signup.submitInstitutionWorkspaceApplication()).rejects.toMatchObject({
        status,
      });
      expect(signup.getInstitutionSignupDraft()?.institution.name).toBe("Internal QA University");
    },
  );

  it("recovers from a stale signup session by starting a fresh one and preserving safe draft fields", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_APP_ENV", "test");
    vi.stubEnv("VITE_DEMO_MODE", "false");
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");

    const startOrganizationStaffSignup = vi.fn().mockResolvedValue({
      signupSessionId: "signup_session_002",
      emailMasked: "p***@northbridge.edu",
      emailVerified: false,
      resendAfterSeconds: 60,
      expiresInSeconds: 600,
      message: "Verification code sent.",
    });
    const sendOrganizationStaffSignupEmail = vi.fn().mockRejectedValue(
      new (await import("@/lib/institution/errors")).InstitutionError({
        code: "NOT_FOUND",
        message: "Signup session not found",
        uiMessage: "Signup session not found",
        status: 404,
      }),
    );

    vi.doMock("@/lib/institution/backend", async () => {
      const actual = await vi.importActual<typeof import("@/lib/institution/backend")>(
        "@/lib/institution/backend",
      );

      return {
        ...actual,
        startOrganizationStaffSignup,
        sendOrganizationStaffSignupEmail,
      };
    });

    const signup = await import("@/lib/institution/signup");

    signup.createInstitutionSignupDraft();
    signup.updateInstitutionDetails({
      name: "Northbridge University",
      city: "Delhi",
      country: "India",
    });
    signup.updateInstitutionAdministrator({
      fullName: "Priya Menon",
      jobTitle: "Registrar",
      workEmail: "priya.menon@northbridge.edu",
      authorized: true,
      password: "super-secret-password",
      confirmPassword: "super-secret-password",
    });
    signup.updateInstitutionVerification({
      method: "email",
      emailStatus: "code_sent",
      signupSessionId: "stale_signup_session",
      emailMasked: "old***@northbridge.edu",
      expiresInSeconds: 600,
    });

    const result = await signup.requestInstitutionEmailVerification();
    const draft = signup.getInstitutionSignupDraft();

    expect(sendOrganizationStaffSignupEmail).toHaveBeenCalledWith("stale_signup_session");
    expect(startOrganizationStaffSignup).toHaveBeenCalledTimes(1);
    expect(startOrganizationStaffSignup).toHaveBeenCalledWith({
      fullName: "Priya Menon",
      workEmail: "priya.menon@northbridge.edu",
      password: "super-secret-password",
    });
    expect(result.recovered).toBe(true);
    expect(draft?.verification.signupSessionId).toBe("signup_session_002");
    expect(draft?.verification.emailStatus).toBe("code_sent");
    expect(draft?.institution.name).toBe("Northbridge University");
    expect(draft?.administrator.password).toBe("super-secret-password");
  });

  it("clears stale email verification state when the administrator work email changes", async () => {
    const signup = await importSignupModule("false");

    signup.createInstitutionSignupDraft();
    signup.updateInstitutionAdministrator({
      fullName: "Priya Menon",
      jobTitle: "Registrar",
      workEmail: "priya.menon@northbridge.edu",
      authorized: true,
      password: "super-secret-password",
      confirmPassword: "super-secret-password",
    });
    signup.updateInstitutionVerification({
      method: "email",
      emailStatus: "code_sent",
      signupSessionId: "stale_signup_session",
      emailMasked: "p***@northbridge.edu",
      resendAfterSeconds: 60,
      expiresInSeconds: 600,
      sessionIssuedAt: "2026-08-03T12:00:00.000Z",
    });

    signup.updateInstitutionAdministrator({
      workEmail: "registrar@northbridge.edu",
      password: "super-secret-password",
      confirmPassword: "super-secret-password",
    });

    const draft = signup.getInstitutionSignupDraft();

    expect(draft?.administrator.workEmail).toBe("registrar@northbridge.edu");
    expect(draft?.verification.emailStatus).toBe("not_started");
    expect(draft?.verification.signupSessionId).toBeUndefined();
    expect(draft?.verification.emailMasked).toBeUndefined();
    expect(draft?.verification.resendAfterSeconds).toBeUndefined();
    expect(draft?.verification.expiresInSeconds).toBeUndefined();
    expect(draft?.verification.sessionIssuedAt).toBeUndefined();
  });

  it("starts a fresh verification session after the administrator work email changes", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_APP_ENV", "test");
    vi.stubEnv("VITE_DEMO_MODE", "false");
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");

    const startOrganizationStaffSignup = vi.fn().mockResolvedValue({
      signupSessionId: "signup_session_003",
      emailMasked: "r***@northbridge.edu",
      emailVerified: false,
      resendAfterSeconds: 60,
      expiresInSeconds: 600,
      message: "Verification code sent.",
    });
    const sendOrganizationStaffSignupEmail = vi.fn();

    vi.doMock("@/lib/institution/backend", async () => {
      const actual = await vi.importActual<typeof import("@/lib/institution/backend")>(
        "@/lib/institution/backend",
      );

      return {
        ...actual,
        startOrganizationStaffSignup,
        sendOrganizationStaffSignupEmail,
      };
    });

    const signup = await import("@/lib/institution/signup");

    signup.createInstitutionSignupDraft();
    signup.updateInstitutionAdministrator({
      fullName: "Priya Menon",
      jobTitle: "Registrar",
      workEmail: "priya.menon@northbridge.edu",
      authorized: true,
      password: "super-secret-password",
      confirmPassword: "super-secret-password",
    });
    signup.updateInstitutionVerification({
      method: "email",
      emailStatus: "code_sent",
      signupSessionId: "stale_signup_session",
      emailMasked: "p***@northbridge.edu",
    });

    signup.updateInstitutionAdministrator({
      workEmail: "registrar@northbridge.edu",
      password: "super-secret-password",
      confirmPassword: "super-secret-password",
    });

    await signup.requestInstitutionEmailVerification();

    expect(sendOrganizationStaffSignupEmail).not.toHaveBeenCalled();
    expect(startOrganizationStaffSignup).toHaveBeenCalledTimes(1);
    expect(startOrganizationStaffSignup).toHaveBeenCalledWith({
      fullName: "Priya Menon",
      workEmail: "registrar@northbridge.edu",
      password: "super-secret-password",
    });
    expect(signup.getInstitutionSignupDraft()?.verification.signupSessionId).toBe(
      "signup_session_003",
    );
  });

  it("derives the correct onboarding continuation step from safe draft fields", async () => {
    const signup = await importSignupModule("false");

    expect(signup.getInstitutionSignupContinuationPath()).toBe(
      signup.INSTITUTION_SIGNUP_ROUTES.institution,
    );

    signup.createInstitutionSignupDraft();
    signup.updateInstitutionDetails({
      name: "Northbridge University",
      type: "University",
      website: "https://northbridge.edu",
      domain: "northbridge.edu",
      country: "India",
      city: "Delhi",
      verificationEmail: "verify@northbridge.edu",
    });
    expect(signup.getInstitutionSignupContinuationPath()).toBe(
      signup.INSTITUTION_SIGNUP_ROUTES.admin,
    );

    signup.updateInstitutionAdministrator({
      fullName: "Priya Menon",
      jobTitle: "Registrar",
      workEmail: "priya.menon@northbridge.edu",
      authorized: true,
      password: "super-secret-password",
      confirmPassword: "super-secret-password",
    });
    expect(signup.getInstitutionSignupContinuationPath()).toBe(
      signup.INSTITUTION_SIGNUP_ROUTES.verify,
    );

    signup.updateInstitutionVerification({
      method: "email",
      emailStatus: "verified",
    });
    expect(signup.getInstitutionSignupContinuationPath()).toBe(
      signup.INSTITUTION_SIGNUP_ROUTES.review,
    );
  });

  it("derives authenticated onboarding steps without routing through email verification", async () => {
    const signup = await importSignupModule("false");
    const bootstrap = noOrgBootstrap();

    expect(signup.getAuthenticatedInstitutionOnboardingPath(bootstrap)).toBe(
      signup.INSTITUTION_SIGNUP_ROUTES.institution,
    );

    signup.updateInstitutionDetails({
      name: "Internal QA University",
      type: "University",
      website: "https://institution.example",
      domain: "institution.example",
      country: "India",
      city: "Delhi",
      verificationEmail: "verification@institution.example",
    });
    expect(signup.getAuthenticatedInstitutionOnboardingPath(bootstrap)).toBe(
      signup.INSTITUTION_SIGNUP_ROUTES.admin,
    );

    signup.updateInstitutionAdministrator({ jobTitle: "Owner", authorized: true });
    expect(signup.getAuthenticatedInstitutionOnboardingPath(bootstrap)).toBe(
      signup.INSTITUTION_SIGNUP_ROUTES.review,
    );
    expect(signup.getAuthenticatedInstitutionOnboardingPath(bootstrap)).not.toBe(
      signup.INSTITUTION_SIGNUP_ROUTES.verify,
    );
  });
});
