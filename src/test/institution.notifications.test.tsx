import { render, screen, waitFor } from "@testing-library/react";
import { RouterProvider } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import userEvent from "@testing-library/user-event";

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

async function renderRoute(path: string) {
  vi.resetModules();
  vi.stubEnv("VITE_APP_ENV", "test");
  vi.stubEnv("VITE_DEMO_MODE", "false");
  vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");

  const notificationsApi = {
    getInstitutionNotifications: vi.fn().mockImplementation(async (filters = {}) => {
      const page = filters.page ?? 1;
      const pageSize = filters.pageSize ?? 20;

      if (page === 2) {
        return {
          items: [
            {
              id: "notif_003",
              category: "verification",
              eventType: "verification_completed",
              title: "Verification completed",
              body: "An institution verification was completed.",
              metadata: {},
              readAt: "2026-08-02T10:00:00Z",
              createdAt: "2026-08-02T09:00:00Z",
            },
          ],
          total: 3,
          page,
          pageSize,
          totalPages: 2,
          offset: 20,
          limit: pageSize,
          unreadCount: 2,
        };
      }

      return {
        items: [
          {
            id: "notif_001",
            category: "verification",
            eventType: "verification_assigned",
            title: "Verification assigned",
            body: "A request was assigned to your institution team.",
            metadata: {
              verification_request_public_id: "vr_001",
            },
            readAt: null,
            createdAt: "2026-08-01T10:00:00Z",
          },
          {
            id: "notif_002",
            category: "system",
            eventType: "security_notice",
            title: "Security notice",
            body: "Review your recent account activity.",
            metadata: {},
            readAt: null,
            createdAt: "2026-08-01T09:00:00Z",
          },
        ],
        total: 3,
        page,
        pageSize,
        totalPages: 2,
        offset: 0,
        limit: pageSize,
        unreadCount: 2,
      };
    }),
    markInstitutionNotificationRead: vi.fn().mockResolvedValue(undefined),
    markAllInstitutionNotificationsRead: vi.fn().mockResolvedValue(undefined),
  };

  vi.doMock("@/lib/institution/api", () => notificationsApi);
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

  window.history.replaceState({}, "", path);

  const { getRouter } = await import("@/router");
  const router = getRouter();

  render(<RouterProvider router={router} />);
  await waitFor(() => expect(router.state.status).not.toBe("pending"));

  return notificationsApi;
}

describe("institution notifications route", () => {
  it("renders notifications, unread count, pagination, and honest missing-target behavior", async () => {
    const notificationsApi = await renderRoute("/institution/notifications");
    const user = userEvent.setup();

    expect(await screen.findByRole("heading", { name: "Notifications" })).toBeInTheDocument();
    expect(screen.getAllByText("2").length).toBeGreaterThan(0);
    expect(screen.getByText("Verification assigned")).toBeInTheDocument();
    expect(screen.getByText("Security notice")).toBeInTheDocument();
    expect(
      screen.getByText("No institution route target is available for this notification yet."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Verification assigned/i })).toHaveAttribute(
      "href",
      "/institution/verifications/vr_001",
    );

    await user.click(screen.getAllByRole("button", { name: "Mark read" })[0]);
    expect(notificationsApi.markInstitutionNotificationRead.mock.calls[0]?.[0]).toBe("notif_001");

    await user.click(screen.getByRole("button", { name: "Mark all read" }));
    expect(notificationsApi.markAllInstitutionNotificationsRead).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() =>
      expect(notificationsApi.getInstitutionNotifications).toHaveBeenLastCalledWith({
        page: 2,
        pageSize: 20,
      }),
    );

    expect(await screen.findByText("Verification completed")).toBeInTheDocument();
  });
});
