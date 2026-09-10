import { render, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";

const DEMO_SESSION_KEY = "kairo.institution.demo.session";

type AuthProbe = {
  hydrated: boolean;
  signIn: (email: string, password: string) => Promise<unknown>;
};

async function importAuthModule(demoMode: "true" | "false", apiBaseUrl = "") {
  vi.resetModules();
  vi.stubEnv("VITE_APP_ENV", "test");
  vi.stubEnv("VITE_DEMO_MODE", demoMode);
  vi.stubEnv("VITE_API_BASE_URL", apiBaseUrl);
  return import("@/lib/institution/auth");
}

async function renderAuthHarness(demoMode: "true" | "false", apiBaseUrl = "") {
  const authModule = await importAuthModule(demoMode, apiBaseUrl);
  let authState: AuthProbe | null = null;

  function Probe() {
    const auth = authModule.useInstitutionAuth();

    useEffect(() => {
      authState = {
        hydrated: auth.hydrated,
        signIn: auth.signIn,
      };
    }, [auth]);

    return null;
  }

  render(
    <authModule.InstitutionAuthProvider>
      <Probe />
    </authModule.InstitutionAuthProvider>,
  );

  await waitFor(() => expect(authState).not.toBeNull());
  await waitFor(() => expect(authState?.hydrated).toBe(true));
  return authState!;
}

describe("institution auth", () => {
  it("rejects invalid demo credentials without creating a session", async () => {
    const auth = await renderAuthHarness("true");

    await expect(
      auth.signIn("unknown.person@northbridge.edu", "demo-password"),
    ).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
    expect(window.sessionStorage.getItem(DEMO_SESSION_KEY)).toBeNull();
  });

  it("does not create a production session when institution auth is unavailable", async () => {
    const auth = await renderAuthHarness("false");

    await expect(auth.signIn("owner@example.edu", "not-a-real-password")).rejects.toMatchObject({
      code: "API_NOT_CONFIGURED",
    });
    expect(window.sessionStorage.getItem(DEMO_SESSION_KEY)).toBeNull();
  });

  it("recognizes an employer-only account as requiring its first Institution workspace", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_APP_ENV", "test");
    vi.stubEnv("VITE_DEMO_MODE", "false");
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");

    const loginInstitutionUser = vi.fn().mockResolvedValue(undefined);
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
        getStoredInstitutionAuthTokens: vi.fn().mockReturnValue({
          accessToken: "access_token_123",
          refreshToken: "refresh_token_123",
          tokenType: "bearer",
          expiresAt: "2099-01-01T00:00:00.000Z",
        }),
        getInstitutionWorkspaceBootstrap: vi.fn().mockResolvedValue({
          state: "ready",
          currentUser: {
            id: "user_001",
            email: "owner@example.com",
            fullName: "Existing Owner",
            role: "user",
            activeOrganizationPublicId: "org_employer",
          },
          activeOrganization: {
            publicId: "org_employer",
            name: "Example Employer",
            organizationType: "employer",
            website: "https://employer.example",
            location: "Delhi, India",
            workEmail: "owner@example.com",
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
        }),
        listCurrentOrganizationMemberships,
        loginInstitutionUser,
      };
    });

    const auth = await renderAuthHarness("false", "https://api.example.com");
    const state = (await auth.signIn("owner@example.com", "not-exposed")) as {
      session: unknown;
      authenticated: boolean;
      institutionOnboardingRequired: boolean;
      error: unknown;
    };

    expect(loginInstitutionUser).toHaveBeenCalledTimes(1);
    expect(listCurrentOrganizationMemberships).toHaveBeenCalledWith("access_token_123");
    expect(state).toMatchObject({
      session: null,
      authenticated: true,
      institutionOnboardingRequired: true,
      error: null,
    });
  });
});
