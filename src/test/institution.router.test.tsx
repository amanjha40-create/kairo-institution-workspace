import { render, screen, waitFor } from "@testing-library/react";
import { RouterProvider } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";

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

async function renderRoute(
  path: string,
  options?: {
    session?: ReturnType<typeof ownerSession> | ReturnType<typeof reviewerSession> | null;
    authenticated?: boolean;
    bootstrap?: ReturnType<typeof noOrgBootstrap> | null;
    demoMode?: "true" | "false";
  },
) {
  vi.resetModules();
  vi.stubEnv("VITE_APP_ENV", "test");
  vi.stubEnv("VITE_DEMO_MODE", options?.demoMode ?? "true");
  vi.stubEnv("VITE_API_BASE_URL", "");

  const authState = {
    session: options?.session ?? null,
    bootstrap: options?.bootstrap ?? null,
    authenticated: options?.authenticated ?? Boolean(options?.session),
    error: null,
    hydrated: true,
    isDemoMode: (options?.demoMode ?? "true") === "true",
    signIn: vi.fn(),
    signOut: vi.fn(),
    refreshSession: vi.fn(),
    requestPasswordReset: vi.fn(),
    completePasswordReset: vi.fn(),
  };

  vi.doMock("@/lib/institution/auth", () => ({
    InstitutionAuthProvider: ({ children }: { children: React.ReactNode }) => children,
    useInstitutionAuth: () => authState,
  }));

  window.history.replaceState({}, "", path);

  const { getRouter } = await import("@/router");
  const router = getRouter();

  render(<RouterProvider router={router} />);

  await waitFor(() => expect(router.state.status).not.toBe("pending"));
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

  it("redirects authenticated users without an active institution to onboarding", async () => {
    await renderRoute("/institution/verifications", {
      session: null,
      authenticated: true,
      bootstrap: noOrgBootstrap(),
      demoMode: "false",
    });

    expect(
      await screen.findByRole("heading", { name: "Tell us about your institution" }),
    ).toBeInTheDocument();
  });

  it("prevents a reviewer from accessing owner-only team actions", async () => {
    await renderRoute("/institution/team", {
      session: reviewerSession(),
      authenticated: true,
      demoMode: "true",
    });

    expect(await screen.findByText("You don't have access to this page")).toBeInTheDocument();
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
