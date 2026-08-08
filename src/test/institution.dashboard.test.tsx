import { render, screen } from "@testing-library/react";
import { RouterProvider } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

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
    expiresAt: "2026-08-08T23:59:59Z",
  };
}

describe("institution dashboard route", () => {
  it("renders fallback dashboard totals and honest unavailable sections", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_APP_ENV", "test");
    vi.stubEnv("VITE_DEMO_MODE", "false");
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");

    const dashboardApi = {
      getInstitutionNotifications: vi.fn().mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
        offset: 0,
        limit: 10,
        unreadCount: 0,
      }),
      markInstitutionNotificationRead: vi.fn(),
      markAllInstitutionNotificationsRead: vi.fn(),
      getInstitutionDashboard: vi.fn().mockResolvedValue({
        pendingVerifications: 4,
        recentlyVerifiedCredentials: [],
        recentlyVerifiedCredentialsAvailable: false,
        verificationActivity: [],
        verificationActivityAvailable: false,
        people: {
          total: 12,
          currentStudent: 5,
          alumni: 4,
          withdrawn: 2,
          inactive: 1,
        },
        statistics: {
          totalVerifications: 9,
          verifiedVerifications: 3,
          awaitingInformation: 2,
          highPriority: 1,
        },
      }),
    };

    vi.doMock("@/lib/institution/api", () => dashboardApi);
    vi.doMock("@/lib/institution/auth", () => ({
      InstitutionAuthProvider: ({ children }: { children: ReactNode }) => children,
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

    window.history.replaceState({}, "", "/institution");

    const { getRouter } = await import("@/router");
    const router = getRouter();

    render(<RouterProvider router={router} />);

    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("Pending verifications")).toBeInTheDocument();
    expect(screen.getByText("Total verifications")).toBeInTheDocument();
    expect(screen.getAllByText("4").length).toBeGreaterThan(0);
    expect(screen.getAllByText("9").length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        "Recent verification activity is not available from the current backend contract yet.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Recently verified credential history is not available from the current backend contract yet.",
      ),
    ).toBeInTheDocument();
    expect(dashboardApi.getInstitutionDashboard).toHaveBeenCalledWith("inst_northbridge");
  }, 10_000);
});
