import { render, screen, waitFor } from "@testing-library/react";
import { RouterProvider } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";

const DEMO_SESSION_KEY = "kairo.institution.demo.session";

function ownerSession() {
  return {
    userId: "u_priya",
    membershipId: "membership_u_priya",
    institutionId: "inst_northbridge",
    name: "Priya Menon",
    email: "priya.menon@northbridge.edu",
    role: "owner",
    institutionName: "Northbridge University",
    accountStatus: "active",
    workspaceStatus: "active",
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
    role: "reviewer",
  };
}

async function renderRoute(path: string, session?: ReturnType<typeof ownerSession>) {
  vi.resetModules();
  vi.stubEnv("VITE_APP_ENV", "test");
  vi.stubEnv("VITE_DEMO_MODE", "true");
  vi.stubEnv("VITE_API_BASE_URL", "");

  if (session) {
    window.sessionStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(session));
  }

  window.history.replaceState({}, "", path);

  const { getRouter } = await import("@/router");
  const router = getRouter();

  render(<RouterProvider router={router} />);

  await waitFor(() => expect(router.state.status).not.toBe("pending"));
}

describe("institution routing and permissions", () => {
  it("redirects protected routes to sign in when signed out", async () => {
    await renderRoute("/institution/verifications");

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });

  it("keeps public routes accessible", async () => {
    await renderRoute("/institution/login");

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });

  it("prevents a reviewer from accessing owner-only team actions", async () => {
    await renderRoute("/institution/team", reviewerSession());

    expect(await screen.findByText("You don't have access to this page")).toBeInTheDocument();
  });

  it("keeps candidate claims and institution records distinctly labeled", async () => {
    await renderRoute("/institution/verifications/req_001", ownerSession());

    expect(await screen.findByText("Candidate-submitted claim")).toBeInTheDocument();
    expect(await screen.findByText("Institution record")).toBeInTheDocument();
  });
});
