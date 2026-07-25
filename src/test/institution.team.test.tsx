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
    expiresAt: "2026-07-25T23:59:59Z",
  };
}

async function renderTeamRoute() {
  vi.resetModules();
  vi.stubEnv("VITE_APP_ENV", "test");
  vi.stubEnv("VITE_DEMO_MODE", "false");
  vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");

  const teamApi = {
    getInstitutionTeam: vi.fn().mockResolvedValue({
      members: [
        {
          id: "member_owner",
          name: "Priya Menon",
          email: "priya.menon@northbridge.edu",
          role: "owner",
          status: "active",
        },
        {
          id: "member_admin",
          name: "Daniel Okafor",
          email: "daniel.okafor@northbridge.edu",
          role: "admin",
          status: "active",
        },
      ],
      invitations: [
        {
          id: "invite_pending",
          email: "marcus.field@northbridge.edu",
          role: "reviewer",
          status: "pending",
          invitedAt: "2026-07-24T10:00:00Z",
          expiresAt: "2026-07-31T10:00:00Z",
        },
        {
          id: "invite_accepted",
          email: "lena.alvarez@northbridge.edu",
          role: "reviewer",
          status: "accepted",
          invitedAt: "2026-07-20T10:00:00Z",
          acceptedAt: "2026-07-21T11:00:00Z",
        },
      ],
    }),
    inviteTeamMember: vi.fn(),
    resendTeamInvitation: vi.fn(),
    cancelTeamInvitation: vi.fn(),
    updateTeamMemberRole: vi.fn(),
    suspendTeamMember: vi.fn(),
    restoreTeamMember: vi.fn(),
    removeTeamMember: vi.fn(),
    transferTeamOwnership: vi.fn(),
  };

  vi.doMock("@/lib/institution/api", () => teamApi);
  vi.doMock("@/lib/institution/auth", () => ({
    InstitutionAuthProvider: ({ children }: { children: React.ReactNode }) => children,
    useInstitutionAuth: () => ({
      session: ownerSession(),
      bootstrap: null,
      authenticated: true,
      error: null,
      hydrated: true,
      isDemoMode: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
      refreshSession: vi.fn(),
      requestPasswordReset: vi.fn(),
      completePasswordReset: vi.fn(),
    }),
  }));

  window.history.replaceState({}, "", "/institution/team");

  const { getRouter } = await import("@/router");
  const router = getRouter();

  render(<RouterProvider router={router} />);
  await waitFor(() => expect(router.state.status).not.toBe("pending"));

  return teamApi;
}

describe("institution team route", () => {
  it("renders current members, pending invitations, and invitation history from the backend adapter", async () => {
    const teamApi = await renderTeamRoute();

    expect(await screen.findByRole("heading", { name: "Team" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pending invitations" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Invitation history" })).toBeInTheDocument();
    expect(screen.getByText("marcus.field@northbridge.edu")).toBeInTheDocument();
    expect(screen.getByText("lena.alvarez@northbridge.edu")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Transfer ownership" })).toBeInTheDocument();
    expect(teamApi.getInstitutionTeam).toHaveBeenCalledWith("inst_northbridge");
  });
});
