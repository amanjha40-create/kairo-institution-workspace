import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    expiresAt: "2026-07-26T23:59:59Z",
  };
}

async function renderSettingsRoute() {
  vi.resetModules();
  vi.stubEnv("VITE_APP_ENV", "test");
  vi.stubEnv("VITE_DEMO_MODE", "false");
  vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");

  const settingsApi = {
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
    getInstitutionSettings: vi.fn().mockResolvedValue({
      institution: {
        id: "inst_northbridge",
        name: "Northbridge University",
        type: "University",
        website: "https://northbridge.edu",
        address: "Northbridge, NB",
        primaryVerificationEmail: "verify@northbridge.edu",
        domain: "northbridge.edu",
        location: "Northbridge, NB",
        workEmail: "verify@northbridge.edu",
        verificationState: "verified",
        domainVerifiedAt: "2026-07-15T09:00:00Z",
      },
      account: {
        fullName: "Priya Menon",
        email: "priya.menon@northbridge.edu",
        phone: "+1 555 010 4421",
        currentRole: "Registrar",
        location: "Northbridge, NB",
        emailVerifiedAt: "2026-07-10T10:00:00Z",
        phoneVerifiedAt: null,
      },
      notifications: [
        {
          id: "pref_invites",
          eventType: "trust_invitation_created",
          label: "Trust invitation",
          description: "Notifications about Trust Invitations relevant to your institution.",
          enabled: true,
          preferredChannels: ["email"],
          required: false,
        },
      ],
      sessions: [
        {
          id: "session_001",
          createdAt: "2026-07-20T08:00:00Z",
          expiresAt: "2026-08-20T08:00:00Z",
          lastActiveAt: "2026-07-26T09:30:00Z",
          current: false,
          device: "MacBook Pro",
          browser: "Chrome",
          location: "Lagos, NG",
        },
      ],
      security: {
        domainVerified: true,
        domainVerifiedAt: "2026-07-15T09:00:00Z",
        canChangePassword: true,
      },
      workspace: {
        verificationPreferencesAvailable: false,
        integrationConnectionsAvailable: false,
        sessionDeviceDetailsAvailable: false,
        mfaAvailable: false,
        securityHistoryAvailable: false,
      },
    }),
    updateInstitutionProfile: vi.fn(),
    updateInstitutionAccountProfile: vi.fn(),
    updateInstitutionNotificationPreferences: vi.fn().mockResolvedValue(undefined),
    revokeInstitutionSession: vi.fn(),
    revokeAllInstitutionSessions: vi.fn(),
    changeInstitutionPassword: vi.fn(),
  };

  const refreshSession = vi.fn();
  const signOut = vi.fn();

  vi.doMock("@/lib/institution/api", () => settingsApi);
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
      signOut,
      refreshSession,
      requestPasswordReset: vi.fn(),
      completePasswordReset: vi.fn(),
    }),
  }));

  window.history.replaceState({}, "", "/institution/settings");

  const { getRouter } = await import("@/router");
  const router = getRouter();

  render(<RouterProvider router={router} />);
  await waitFor(() => expect(router.state.status).not.toBe("pending"));

  return {
    settingsApi,
    refreshSession,
    signOut,
    user: userEvent.setup(),
  };
}

describe("institution settings route", () => {
  it("renders backend-driven settings and honest unavailable sections", async () => {
    const { settingsApi } = await renderSettingsRoute();

    expect(await screen.findByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Northbridge University")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Priya Menon")).toBeInTheDocument();
    expect(screen.getByText("Verification preferences")).toBeInTheDocument();
    expect(screen.getByText(/are not exposed by the shared backend/i)).toBeInTheDocument();
    expect(screen.getByText(/MacBook Pro · Chrome · Lagos, NG/i)).toBeInTheDocument();
    expect(screen.getByText("Student Information System")).toBeInTheDocument();
    expect(screen.getByText("Multi-factor authentication")).toBeInTheDocument();
    expect(settingsApi.getInstitutionSettings).toHaveBeenCalledWith("inst_northbridge");
  });

  it("saves notification preferences through the backend adapter", async () => {
    const { settingsApi, user } = await renderSettingsRoute();

    const toggle = await screen.findByRole("switch", { name: "" });
    await user.click(toggle);
    await user.click(screen.getAllByRole("button", { name: "Save changes" })[2]);

    await waitFor(() =>
      expect(settingsApi.updateInstitutionNotificationPreferences).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            eventType: "trust_invitation_created",
            enabled: false,
          }),
        ]),
      ),
    );
  });
});
