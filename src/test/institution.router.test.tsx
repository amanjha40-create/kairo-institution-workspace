import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderInstitutionRoute } from "@/test/router-test-utils";
import type { InstitutionWorkspaceBootstrap } from "@/lib/institution/types";

vi.stubGlobal(
  "ResizeObserver",
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

function ownerSession() {
  return {
    userId: "u_priya",
    membershipId: "membership_u_priya",
    institutionId: "inst_northbridge",
    name: "Priya Menon",
    email: "priya.menon@northbridge.edu",
    role: "owner" as const,
    institutionName: "Northbridge University",
    accountStatus: "active" as const,
    workspaceStatus: "active" as const,
    expiresAt: "2026-07-24T23:59:59Z",
  };
}

function reviewerSession() {
  return {
    ...ownerSession(),
    userId: "u_hana",
    membershipId: "membership_u_hana",
    name: "Hana Suzuki",
    email: "hana.suzuki@northbridge.edu",
    role: "reviewer" as const,
  };
}

function noOrgBootstrap() {
  return {
    state: "no_org" as const,
    currentUser: {
      id: "u_priya",
      email: "priya.menon@northbridge.edu",
      fullName: "Priya Menon",
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

function employerBootstrap(): InstitutionWorkspaceBootstrap {
  return {
    state: "ready",
    currentUser: {
      id: "u_priya",
      email: "priya@example.com",
      fullName: "Priya Menon",
      role: "user",
      activeOrganizationPublicId: "org_employer",
    },
    activeOrganization: {
      publicId: "org_employer",
      name: "Example Employer",
      organizationType: "employer",
      website: "https://employer.example",
      location: "Delhi, India",
      workEmail: "priya@example.com",
      domain: "employer.example",
      verificationState: "verified",
      setupCompletedAt: "2026-09-01T00:00:00.000Z",
      suspendedAt: null,
    },
    membershipRole: "owner",
    organizationVerificationState: "verified",
    organizationSuspended: false,
    membershipSuspended: false,
    setupCompleted: true,
    permissionFlags: {
      inviteCandidate: true,
      modifyPerson: true,
      modifyInvitation: true,
      modifyVerification: true,
      manageTeam: true,
      saveSettings: true,
      transferOwnership: true,
    },
  };
}

async function renderRoute(
  path: string,
  options?: {
    session?: ReturnType<typeof ownerSession> | ReturnType<typeof reviewerSession> | null;
    authenticated?: boolean;
    bootstrap?: InstitutionWorkspaceBootstrap | null;
    institutionOnboardingRequired?: boolean;
    demoMode?: "true" | "false";
    error?: { uiMessage: string } | null;
    completeInstitutionWorkspaceOnboarding?: ReturnType<typeof vi.fn>;
    refreshSessionResult?: ReturnType<typeof ownerSession> | null;
    signInResult?: {
      session: ReturnType<typeof ownerSession> | null;
      authenticated: boolean;
      bootstrap: InstitutionWorkspaceBootstrap | null;
      institutionOnboardingRequired?: boolean;
      error: { uiMessage: string } | null;
    };
  },
) {
  vi.resetModules();
  vi.stubEnv("VITE_APP_ENV", "test");
  vi.stubEnv("VITE_DEMO_MODE", options?.demoMode ?? "true");
  vi.stubEnv(
    "VITE_API_BASE_URL",
    options?.completeInstitutionWorkspaceOnboarding ? "https://api.example.com" : "",
  );

  vi.doUnmock("@/lib/institution/backend");
  if (options?.completeInstitutionWorkspaceOnboarding) {
    const completeInstitutionWorkspaceOnboarding = options.completeInstitutionWorkspaceOnboarding;
    vi.doMock("@/lib/institution/backend", async () => {
      const actual = await vi.importActual<typeof import("@/lib/institution/backend")>(
        "@/lib/institution/backend",
      );
      return {
        ...actual,
        completeInstitutionWorkspaceOnboarding,
        listCurrentOrganizationMemberships: vi.fn().mockResolvedValue([]),
        getStoredInstitutionAuthTokens: vi.fn().mockReturnValue({
          accessToken: "access_token_123",
          refreshToken: "refresh_token_123",
          tokenType: "bearer",
          expiresAt: "2099-01-01T00:00:00.000Z",
        }),
      };
    });
  }

  const authState = {
    session: options?.session ?? null,
    bootstrap: options?.bootstrap ?? null,
    authenticated: options?.authenticated ?? Boolean(options?.session),
    institutionOnboardingRequired: options?.institutionOnboardingRequired ?? false,
    error: options?.error ?? null,
    hydrated: true,
    isDemoMode: (options?.demoMode ?? "true") === "true",
    signIn: vi.fn(),
    signOut: vi.fn(),
    refreshSession: vi.fn(),
    requestPasswordReset: vi.fn(),
    completePasswordReset: vi.fn(),
  };
  authState.refreshSession.mockImplementation(async () => {
    const nextSession = options?.refreshSessionResult ?? authState.session;
    authState.session = nextSession;
    return nextSession;
  });
  authState.signIn.mockImplementation(async () => {
    if (options?.signInResult) {
      authState.session = options.signInResult.session;
      authState.authenticated = options.signInResult.authenticated;
      authState.bootstrap = options.signInResult.bootstrap;
      authState.institutionOnboardingRequired =
        options.signInResult.institutionOnboardingRequired ?? false;
      authState.error = options.signInResult.error;
      return options.signInResult;
    }
    return {
      session: authState.session,
      authenticated: authState.authenticated,
      bootstrap: authState.bootstrap,
      institutionOnboardingRequired: authState.institutionOnboardingRequired,
      error: authState.error,
    };
  });

  vi.doMock("@/lib/institution/auth", () => ({
    InstitutionAuthProvider: ({ children }: { children: React.ReactNode }) => children,
    useInstitutionAuth: () => authState,
  }));

  await renderInstitutionRoute(path);
  return authState;
}

describe("institution routing and permissions", () => {
  it("redirects protected routes to sign in when signed out", async () => {
    await renderRoute("/institution/verifications", {
      session: null,
      authenticated: false,
      demoMode: "true",
    });

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });

  it("keeps public routes accessible", async () => {
    await renderRoute("/institution/login", {
      session: null,
      authenticated: false,
      demoMode: "true",
    });

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });

  it("keeps production onboarding type selection truthful and placeholders generic", async () => {
    await renderRoute("/institution/signup/institution", {
      session: null,
      authenticated: false,
      demoMode: "false",
    });

    expect(
      await screen.findByRole("heading", { name: "Tell us about your institution" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "University" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "College" })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("northbridge.edu")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("verify@northbridge.edu")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("institution.edu")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("verification@institution.edu")).toBeInTheDocument();
  });

  it("renders password reset completion from the reset token query", async () => {
    await renderRoute("/institution/login?reset_token=reset_token_123", {
      session: null,
      authenticated: false,
      demoMode: "false",
    });

    expect(await screen.findByRole("heading", { name: "Reset password" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Choose a new password to finish resetting your Institution Workspace account.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update password" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign in" })).not.toBeInTheDocument();
  });

  it("renders a valid public verification link without redirecting to institution sign in", async () => {
    await renderRoute("/institution/verify/valid-token", {
      session: null,
      authenticated: false,
      demoMode: "true",
    });

    expect(
      await screen.findByRole("heading", { name: "Education Verification Request" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Consent received")).toBeInTheDocument();
    expect(screen.getByText("Degree_Certificate.pdf")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Sign in" })).not.toBeInTheDocument();
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("shows a terminal public verification state without requiring workspace authentication", async () => {
    await renderRoute("/institution/verify/completed-token", {
      session: null,
      authenticated: false,
      demoMode: "true",
    });

    expect(
      await screen.findByRole("heading", { name: "Verification response already submitted" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Confirm")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Sign in" })).not.toBeInTheDocument();
  });

  it("redirects authenticated users without an active institution to onboarding", async () => {
    await renderRoute("/institution/verifications", {
      session: null,
      authenticated: true,
      bootstrap: noOrgBootstrap(),
      demoMode: "false",
    });

    expect(
      await screen.findByRole("heading", { name: "Set up your institution workspace" }),
    ).toBeInTheDocument();
  });

  it("fails closed when authenticated workspace bootstrap fails", async () => {
    await renderRoute("/institution/verifications", {
      session: null,
      authenticated: true,
      bootstrap: null,
      demoMode: "false",
      error: { uiMessage: "Workspace bootstrap is unavailable." },
    });

    expect(await screen.findByText("Institution workspace unavailable")).toBeInTheDocument();
    expect(screen.getByText("Workspace bootstrap is unavailable.")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Tell us about your institution" }),
    ).not.toBeInTheDocument();
  });

  it("routes an existing account login with no organization into setup without a redirect loop", async () => {
    window.localStorage.setItem(
      "kairo.institution.signup.draft",
      JSON.stringify({
        id: "draft_login_resume",
        institution: {
          name: "Internal QA University",
          type: "University",
          website: "https://institution.example",
          domain: "institution.example",
          country: "India",
          city: "Delhi",
          verificationEmail: "verification@institution.example",
        },
        administrator: {
          fullName: "Stale Name",
          jobTitle: "Owner",
          workEmail: "stale@example.edu",
          authorized: true,
        },
        verification: {
          method: "email",
          emailStatus: "code_sent",
          signupSessionId: "malformed-stale-session",
        },
        acceptedTerms: false,
        acceptedPrivacy: false,
        acceptedAuthority: false,
        updatedAt: "2026-09-09T00:00:00.000Z",
      }),
    );
    const bootstrap = noOrgBootstrap();
    const authState = await renderRoute("/institution/login", {
      authenticated: false,
      bootstrap: null,
      demoMode: "false",
      signInResult: { session: null, authenticated: true, bootstrap, error: null },
    });

    fireEvent.change(screen.getByLabelText("Work email"), {
      target: { value: "priya.menon@northbridge.edu" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "not-exposed-in-storage" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "Review and submit" })).toBeInTheDocument();
    expect(authState.signIn).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("heading", { name: "Sign in" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Send verification code" }),
    ).not.toBeInTheDocument();
  });

  it("routes an employer-only account into Institution onboarding without restarting OTP", async () => {
    window.localStorage.setItem(
      "kairo.institution.signup.draft",
      JSON.stringify({
        id: "draft_employer_account",
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
          fullName: "Stale Name",
          jobTitle: "",
          workEmail: "stale@example.edu",
          authorized: false,
        },
        verification: {
          method: "email",
          emailStatus: "code_sent",
          signupSessionId: "stale-signup-session",
        },
        acceptedTerms: false,
        acceptedPrivacy: false,
        acceptedAuthority: false,
        updatedAt: "2026-09-09T00:00:00.000Z",
      }),
    );
    const bootstrap = employerBootstrap();
    const authState = await renderRoute("/institution/login", {
      authenticated: false,
      bootstrap: null,
      demoMode: "false",
      signInResult: {
        session: null,
        authenticated: true,
        bootstrap,
        institutionOnboardingRequired: true,
        error: null,
      },
    });

    fireEvent.change(screen.getByLabelText("Work email"), {
      target: { value: "priya@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "not-exposed-in-storage" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByRole("heading", { name: "Set up your institution workspace" }),
    ).toBeInTheDocument();
    expect(authState.signIn).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("button", { name: "Send verification code" }),
    ).not.toBeInTheDocument();
    const persisted = JSON.parse(
      window.localStorage.getItem("kairo.institution.signup.draft") as string,
    );
    expect(persisted.verification.signupSessionId).toBeUndefined();
    expect(persisted.administrator.workEmail).toBe("priya@example.com");
  });

  it.each(["8a57e947-830b-456d-a290-8251c2be6bd1", "malformed-stale-session"])(
    "skips organization-signup OTP for authenticated onboarding with stale session %s",
    async (signupSessionId) => {
      window.localStorage.setItem(
        "kairo.institution.signup.draft",
        JSON.stringify({
          id: "draft_resume",
          institution: {
            name: "Northbridge University",
            type: "University",
            website: "https://northbridge.edu",
            domain: "northbridge.edu",
            country: "India",
            city: "Delhi",
            verificationEmail: "verify@northbridge.edu",
          },
          administrator: {
            fullName: "Priya Menon",
            jobTitle: "Registrar",
            workEmail: "priya.menon@northbridge.edu",
            authorized: true,
          },
          verification: {
            method: "email",
            emailStatus: "code_sent",
            signupSessionId,
          },
          acceptedTerms: false,
          acceptedPrivacy: false,
          acceptedAuthority: false,
          updatedAt: "2026-08-03T12:00:00.000Z",
        }),
      );

      await renderRoute("/institution/verifications", {
        session: null,
        authenticated: true,
        bootstrap: noOrgBootstrap(),
        demoMode: "false",
      });

      expect(await screen.findByRole("heading", { name: "Review and submit" })).toBeInTheDocument();
      expect(screen.getByText("Existing verified KairoID account")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Send verification code" }),
      ).not.toBeInTheDocument();

      const persisted = JSON.parse(
        window.localStorage.getItem("kairo.institution.signup.draft") as string,
      );
      expect(persisted.verification.signupSessionId).toBeUndefined();
      expect(persisted.verification.emailStatus).toBe("verified");
    },
  );

  it("shows existing-account administrator setup without account-creation fields", async () => {
    window.localStorage.setItem(
      "kairo.institution.signup.draft",
      JSON.stringify({
        id: "draft_existing_account",
        institution: {
          name: "Internal QA University",
          type: "University",
          website: "https://institution.example",
          domain: "institution.example",
          country: "India",
          city: "Delhi",
          verificationEmail: "verification@institution.example",
        },
        administrator: {
          fullName: "Stale Name",
          jobTitle: "",
          workEmail: "stale@example.edu",
          authorized: false,
        },
        verification: {
          method: "email",
          emailStatus: "code_sent",
          signupSessionId: "malformed-stale-session",
        },
        acceptedTerms: false,
        acceptedPrivacy: false,
        acceptedAuthority: false,
        updatedAt: "2026-09-09T00:00:00.000Z",
      }),
    );

    await renderRoute("/institution/signup/admin", {
      session: null,
      authenticated: true,
      bootstrap: noOrgBootstrap(),
      demoMode: "false",
    });

    expect(
      await screen.findByRole("heading", { name: "Workspace administrator" }),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("Priya Menon")).toBeDisabled();
    expect(screen.getByDisplayValue("priya.menon@northbridge.edu")).toBeDisabled();
    expect(screen.queryByText("Password")).not.toBeInTheDocument();
    expect(screen.queryByText("Confirm password")).not.toBeInTheDocument();
    expect(screen.getByText(/No new password or email code is required/)).toBeInTheDocument();
  });

  it("keeps password and email-verification steps for a new organization staff account", async () => {
    window.localStorage.setItem(
      "kairo.institution.signup.draft",
      JSON.stringify({
        id: "draft_new_account",
        institution: {
          name: "New University",
          type: "University",
          website: "https://new.example.edu",
          domain: "new.example.edu",
          country: "India",
          city: "Delhi",
          verificationEmail: "verification@new.example.edu",
        },
        administrator: {
          fullName: "New Owner",
          jobTitle: "Registrar",
          workEmail: "owner@new.example.edu",
          authorized: true,
        },
        verification: { method: "email", emailStatus: "not_started" },
        acceptedTerms: false,
        acceptedPrivacy: false,
        acceptedAuthority: false,
        updatedAt: "2026-09-09T00:00:00.000Z",
      }),
    );

    await renderRoute("/institution/signup/admin", {
      session: null,
      authenticated: false,
      bootstrap: null,
      demoMode: "false",
    });

    expect(
      await screen.findByRole("heading", { name: "Administrator details" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Password")).toBeInTheDocument();
    expect(screen.getByText("Confirm password")).toBeInTheDocument();
  });

  it("refreshes bootstrap into the Owner workspace and prevents a repeated onboarding submit", async () => {
    window.localStorage.setItem(
      "kairo.institution.signup.draft",
      JSON.stringify({
        id: "draft_submit_existing_account",
        institution: {
          name: "Internal QA University",
          type: "University",
          website: "https://institution.example",
          domain: "institution.example",
          country: "India",
          city: "Delhi",
          verificationEmail: "verification@institution.example",
        },
        administrator: {
          fullName: "Stale Name",
          jobTitle: "Registrar",
          workEmail: "stale@example.edu",
          authorized: true,
        },
        verification: {
          method: "email",
          emailStatus: "code_sent",
          signupSessionId: "malformed-stale-session",
        },
        acceptedTerms: true,
        acceptedPrivacy: true,
        acceptedAuthority: true,
        updatedAt: "2026-09-09T00:00:00.000Z",
      }),
    );
    const completeInstitutionWorkspaceOnboarding = vi.fn().mockResolvedValue({
      publicId: "inst_northbridge",
      name: "Internal QA University",
    });
    const authState = await renderRoute("/institution/signup/review", {
      session: null,
      authenticated: true,
      bootstrap: noOrgBootstrap(),
      demoMode: "false",
      completeInstitutionWorkspaceOnboarding,
      refreshSessionResult: ownerSession(),
    });

    const submit = await screen.findByRole("button", { name: "Create Institution Workspace" });
    fireEvent.click(submit);
    fireEvent.click(submit);

    expect(
      await screen.findByRole("heading", { name: "Institution workspace request submitted" }),
    ).toBeInTheDocument();
    expect(completeInstitutionWorkspaceOnboarding).toHaveBeenCalledTimes(1);
    expect(authState.refreshSession).toHaveBeenCalledTimes(1);
    expect(authState.session?.role).toBe("owner");
    expect(screen.getAllByRole("link", { name: "Open Workspace" })).toHaveLength(2);
  });

  it("does not let a stale signup draft override an active institution workspace", async () => {
    window.localStorage.setItem(
      "kairo.institution.signup.draft",
      JSON.stringify({
        id: "draft_stale",
        institution: {
          name: "Stale University",
          type: "University",
          website: "https://stale.example.edu",
          domain: "stale.example.edu",
          country: "India",
          city: "Delhi",
          verificationEmail: "verify@stale.example.edu",
        },
        administrator: {
          fullName: "Stale Owner",
          jobTitle: "Registrar",
          workEmail: "stale.owner@stale.example.edu",
          authorized: true,
        },
        verification: {
          method: "email",
          emailStatus: "code_sent",
        },
        acceptedTerms: false,
        acceptedPrivacy: false,
        acceptedAuthority: false,
        updatedAt: "2026-08-03T12:00:00.000Z",
      }),
    );

    await renderRoute("/institution/verifications", {
      session: ownerSession(),
      authenticated: true,
      demoMode: "true",
    });

    expect(
      await screen.findByRole("heading", { name: "Verification Requests" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Verify your institution" }),
    ).not.toBeInTheDocument();
  });

  it("prevents a reviewer from accessing owner-only team actions", async () => {
    await renderRoute("/institution/team", {
      session: reviewerSession(),
      authenticated: true,
      demoMode: "true",
    });

    expect(await screen.findByText("You don't have access to this page")).toBeInTheDocument();
  });

  it("shows signup success from authenticated workspace truth even without a stored application draft", async () => {
    window.localStorage.removeItem("kairo.institution.signup.application");

    await renderRoute("/institution/signup/success", {
      session: ownerSession(),
      authenticated: true,
      demoMode: "false",
    });

    expect(
      await screen.findByRole("heading", { name: "Institution workspace request submitted" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Northbridge University").length).toBeGreaterThan(0);
    expect(screen.queryByText("No signup request found")).not.toBeInTheDocument();
  });

  it("keeps candidate claims and institution records distinctly labeled", async () => {
    await renderRoute("/institution/verifications/req_001", {
      session: ownerSession(),
      authenticated: true,
      demoMode: "true",
    });

    expect(await screen.findByText("Candidate-submitted claim")).toBeInTheDocument();
    expect(await screen.findByText("Institution record")).toBeInTheDocument();
  });
});
