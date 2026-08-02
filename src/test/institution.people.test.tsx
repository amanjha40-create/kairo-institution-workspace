import { render, screen, waitFor } from "@testing-library/react";
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
    expiresAt: "2026-07-26T23:59:59Z",
  };
}

async function renderRoute(path: string) {
  vi.resetModules();
  vi.stubEnv("VITE_APP_ENV", "test");
  vi.stubEnv("VITE_DEMO_MODE", "false");
  vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");

  const peopleApi = {
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
    getInstitutionPeople: vi.fn().mockResolvedValue({
      items: [
        {
          id: "person_001",
          name: "Amina Rahman",
          institutionStatus: "alumni",
          trustStatus: "verified",
          passportStatus: "connected",
          degree: "Bachelor of Science",
          graduationYear: "2024",
          studentIdMasked: "*******0142",
          relationship: {
            institutionName: "—",
            studentId: "*******0142",
            status: "alumni",
            degree: "Bachelor of Science",
            programme: "Computer Science",
            department: "Engineering",
            admissionPeriod: "2020",
            graduationPeriod: "2024",
            verificationStatus: "verified",
          },
          sharedProfile: {
            consented: true,
            currentTitle: "Software Engineer",
            currentCompany: "Kairo Labs",
            fields: [
              {
                field: "current_title",
                value: "Software Engineer",
                consentedAt: "2026-07-20T10:00:00Z",
              },
            ],
            consentedFields: ["current_title", "current_employer"],
          },
          credentials: [],
          verificationActivity: [],
          timeline: [],
          lastUpdated: "2026-07-24T10:00:00Z",
        },
      ],
      total: 1,
    }),
    getInstitutionPerson: vi.fn().mockResolvedValue({
      id: "person_001",
      name: "Amina Rahman",
      institutionStatus: "alumni",
      trustStatus: "verified",
      passportStatus: "sharing_limited",
      degree: "Bachelor of Science",
      graduationYear: "2024",
      studentIdMasked: "*******0142",
      relationship: {
        institutionName: "—",
        studentId: "NB-2020-0142",
        status: "alumni",
        degree: "Bachelor of Science",
        programme: "Computer Science",
        department: "Engineering",
        admissionPeriod: "2020",
        graduationPeriod: "2024",
        verificationStatus: "verified",
      },
      sharedProfile: {
        consented: true,
        currentTitle: "Software Engineer",
        currentCompany: undefined,
        fields: [
          {
            field: "current_title",
            value: "Software Engineer",
            consentedAt: "2026-07-20T10:00:00Z",
          },
        ],
        consentedFields: ["current_title", "current_employer"],
      },
      credentials: [],
      verificationActivity: [],
      timeline: [
        {
          id: "life_001",
          at: "2026-07-24T10:00:00Z",
          label: "Lifecycle changed to Alumni",
        },
      ],
      lastUpdated: "2026-07-24T10:00:00Z",
    }),
    getInstitutionPersonVerificationHistory: vi.fn().mockResolvedValue([
      {
        id: "event_001",
        requestingOrg: "Status Changed",
        date: "2026-07-24T10:00:00Z",
        result: "pending to verified",
        reviewer: "Organization",
        status: "in_progress",
        requestId: "vr_001",
        previousStatus: "pending",
        newStatus: "verified",
      },
    ]),
    getInstitutionPersonCredentials: vi.fn().mockResolvedValue([
      {
        id: "cred_001",
        name: "Bachelor of Science Degree Certificate",
        status: "issued",
        issueDate: "2024-06-15",
        issuePeriod: "2024",
        lastUpdated: "2026-07-24T09:00:00Z",
        history: [
          {
            at: "2026-07-24T09:00:00Z",
            label: "Issued",
          },
        ],
        credentialType: "degree_certificate",
        programme: "Computer Science",
      },
    ]),
    getInstitutionPersonPassportSummary: vi.fn().mockResolvedValue({
      personId: "person_001",
      displayName: "Amina Rahman",
      lifecycleStatus: "alumni",
      degree: "Bachelor of Science",
      programme: "Computer Science",
      department: "Engineering",
      admissionPeriod: "2020",
      graduationPeriod: "2024",
      verificationStatus: "verified",
      consentedProfessionalFields: ["current_title"],
      professionalInformation: [
        {
          field: "current_title",
          value: "Software Engineer",
          consentedAt: "2026-07-20T10:00:00Z",
        },
      ],
      credentials: [
        {
          id: "cred_001",
          title: "Bachelor of Science Degree Certificate",
          credentialType: "degree_certificate",
          status: "issued",
          issuedPeriod: "2024",
        },
      ],
    }),
  };

  vi.doMock("@/lib/institution/api", () => peopleApi);
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

  return peopleApi;
}

describe("institution people routes", () => {
  it("renders the backend-driven institution people list", async () => {
    const peopleApi = await renderRoute("/institution/people");

    expect(await screen.findByRole("heading", { name: "People" })).toBeInTheDocument();
    expect(screen.getAllByText("Amina Rahman").length).toBeGreaterThan(0);
    expect(screen.getAllByText("*******0142").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Software Engineer").length).toBeGreaterThan(0);
    expect(peopleApi.getInstitutionPeople).toHaveBeenCalledWith(
      "inst_northbridge",
      expect.objectContaining({ pageSize: 100 }),
    );
  }, 10_000);

  it("renders person detail with full student ID, verification history, and credential history", async () => {
    const peopleApi = await renderRoute("/institution/people/person_001");

    expect(await screen.findByText("Institution relationship")).toBeInTheDocument();
    expect(screen.getByText("Passport summary")).toBeInTheDocument();
    expect(screen.getByText("NB-2020-0142")).toBeInTheDocument();
    expect(screen.getByText("Bachelor of Science Degree Certificate")).toBeInTheDocument();
    expect(screen.getByText("pending to verified")).toBeInTheDocument();
    expect(screen.getByText("Lifecycle changed to Alumni")).toBeInTheDocument();
    expect(peopleApi.getInstitutionPerson).toHaveBeenCalledWith("inst_northbridge", "person_001");
    expect(peopleApi.getInstitutionPersonPassportSummary).toHaveBeenCalledWith(
      "inst_northbridge",
      "person_001",
    );
    expect(peopleApi.getInstitutionPersonVerificationHistory).toHaveBeenCalledWith(
      "inst_northbridge",
      "person_001",
    );
    expect(peopleApi.getInstitutionPersonCredentials).toHaveBeenCalledWith(
      "inst_northbridge",
      "person_001",
    );
  });
});
