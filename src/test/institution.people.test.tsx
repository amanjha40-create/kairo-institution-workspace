import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { renderInstitutionRoute } from "@/test/router-test-utils";

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

async function renderRoute(
  path: string,
  overrides: Record<string, ReturnType<typeof vi.fn>> = {},
  detailError?: "not_found" | "forbidden",
) {
  vi.resetModules();
  vi.stubEnv("VITE_APP_ENV", "test");
  vi.stubEnv("VITE_DEMO_MODE", "false");
  vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
  const errors = await import("@/lib/institution/errors");

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
    getInstitutionPeople: vi.fn().mockImplementation(async (_organizationId, filters = {}) => {
      const page = filters.page ?? 1;
      const pageSize = filters.pageSize ?? 25;
      const search = filters.search ?? "";
      const people =
        search === "sam"
          ? [
              {
                id: "person_002",
                name: "Sam Okoro",
                institutionStatus: "current_student",
                trustStatus: "pending",
                degree: "Master of Science",
                graduationYear: "2026",
                studentIdMasked: "*******0991",
                relationship: {
                  institutionName: "—",
                  studentId: "*******0991",
                  status: "current_student",
                  degree: "Master of Science",
                  programme: "Data Science",
                  department: "Engineering",
                  admissionPeriod: "2024",
                  graduationPeriod: "2026",
                  verificationStatus: "pending",
                },
                sharedProfile: {
                  consented: false,
                },
                credentials: [],
                verificationActivity: [],
                timeline: [],
                lastUpdated: "2026-07-24T10:00:00Z",
              },
            ]
          : page === 2
            ? [
                {
                  id: "person_003",
                  name: "Jordan Lee",
                  institutionStatus: "alumni",
                  trustStatus: "verified",
                  degree: "Bachelor of Arts",
                  graduationYear: "2023",
                  studentIdMasked: "*******0203",
                  relationship: {
                    institutionName: "—",
                    studentId: "*******0203",
                    status: "alumni",
                    degree: "Bachelor of Arts",
                    programme: "Economics",
                    department: "Business",
                    admissionPeriod: "2019",
                    graduationPeriod: "2023",
                    verificationStatus: "verified",
                  },
                  sharedProfile: {
                    consented: false,
                  },
                  credentials: [],
                  verificationActivity: [],
                  timeline: [],
                  lastUpdated: "2026-07-24T10:00:00Z",
                },
              ]
            : [
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
                    currentCompany: "KairoID Labs",
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
              ];

      const total = search === "sam" ? 1 : 26;

      return {
        items: people,
        total,
        page,
        pageSize,
        totalPages: search === "sam" ? 1 : 2,
        offset: (page - 1) * pageSize,
        limit: pageSize,
      };
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
    getInstitutionPersonDetail: vi.fn().mockImplementation(async () => ({
      kind: "institution",
      person: await peopleApi.getInstitutionPerson(),
    })),
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
    ...overrides,
    ...(detailError
      ? {
          getInstitutionPersonDetail: vi
            .fn()
            .mockRejectedValue(
              detailError === "not_found" ? errors.notFoundError() : errors.forbiddenError(),
            ),
        }
      : {}),
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

  await renderInstitutionRoute(path);

  return peopleApi;
}

describe("institution people routes", () => {
  it("renders the backend-driven institution people list", async () => {
    const peopleApi = await renderRoute("/institution/people");

    expect(await screen.findByRole("heading", { name: "People" })).toBeInTheDocument();
    expect(screen.getAllByText("Amina Rahman").length).toBeGreaterThan(0);
    expect(screen.getAllByText("*******0142").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Software Engineer").length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        /Programme, department, and graduation filter options are hidden until the backend returns authoritative filter metadata/i,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("All programmes")).not.toBeInTheDocument();
    expect(peopleApi.getInstitutionPeople).toHaveBeenCalledWith(
      "inst_northbridge",
      expect.objectContaining({ page: 1, pageSize: 25 }),
    );
  }, 10_000);

  it("renders server-provided pagination metadata", async () => {
    const peopleApi = await renderRoute("/institution/people");
    expect(await screen.findByText(/Showing 1-1 of 26 people/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Page 1 of 2/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
    expect(peopleApi.getInstitutionPeople).toHaveBeenLastCalledWith(
      "inst_northbridge",
      expect.objectContaining({ page: 1, pageSize: 25 }),
    );
  });

  it("renders person detail with full student ID, verification history, and credential history", async () => {
    const peopleApi = await renderRoute("/institution/people/person_001");

    expect(await screen.findByText("Institution relationship")).toBeInTheDocument();
    expect(screen.getByText("Passport summary")).toBeInTheDocument();
    expect(screen.getByText("NB-2020-0142")).toBeInTheDocument();
    expect(screen.getByText("Bachelor of Science Degree Certificate")).toBeInTheDocument();
    expect(screen.getByText("pending to verified")).toBeInTheDocument();
    expect(screen.getByText("Lifecycle changed to Alumni")).toBeInTheDocument();
    expect(peopleApi.getInstitutionPersonDetail).toHaveBeenCalledWith(
      "inst_northbridge",
      "person_001",
      { importId: undefined, rowNumber: undefined },
    );
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

  it("renders a roster-only student from the canonical organization-person ID", async () => {
    const getInstitutionPersonDetail = vi.fn().mockResolvedValue({
      kind: "organization_roster",
      person: {
        id: "person_roster_001",
        fullName: "Roster Student",
        email: "roster.student@university.edu",
        phone: null,
        rosterData: {
          student_id: "STU-001",
          roll_number: "ROLL-9",
          degree: "Bachelor of Science",
          program: "Computer Science",
          department: "Engineering",
          admission_date: "2024",
          enrollment_status: "current",
        },
        sourceStatus: "organization_provided",
        verified: false,
        sourceImportId: "import_001",
        sourceRowNumber: 2,
        importedAt: "2026-09-09T10:00:00Z",
      },
    });
    const peopleApi = await renderRoute(
      "/institution/people/person_roster_001?rosterImportId=import_001&rosterRowNumber=2",
      { getInstitutionPersonDetail },
    );

    expect(await screen.findByRole("heading", { name: "Roster Student" })).toBeInTheDocument();
    expect(screen.getByText("Organization-provided")).toBeInTheDocument();
    expect(screen.getByText("STU-001")).toBeInTheDocument();
    expect(screen.getByText("ROLL-9")).toBeInTheDocument();
    expect(screen.getByText("roster.student@university.edu")).toBeInTheDocument();
    expect(screen.getByText("Candidate-owned information unavailable")).toBeInTheDocument();
    expect(screen.getAllByText("Not available").length).toBeGreaterThan(0);
    expect(screen.queryByText(/^Verified$/)).not.toBeInTheDocument();
    expect(screen.queryByText("Passport summary")).not.toBeInTheDocument();
    expect(screen.queryByText("Institution credentials")).not.toBeInTheDocument();
    expect(screen.queryByText("Verification activity")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Student roster" })).toHaveAttribute(
      "href",
      "/institution/people/students",
    );
    expect(peopleApi.getInstitutionPersonPassportSummary).not.toHaveBeenCalled();
    expect(peopleApi.getInstitutionPersonVerificationHistory).not.toHaveBeenCalled();
    expect(peopleApi.getInstitutionPersonCredentials).not.toHaveBeenCalled();
    expect(getInstitutionPersonDetail).toHaveBeenCalledWith(
      "inst_northbridge",
      "person_roster_001",
      { importId: "import_001", rowNumber: 2 },
    );
  });

  it("keeps missing people as a clean not-found state", async () => {
    await renderRoute("/institution/people/missing", {}, "not_found");
    expect(await screen.findByText("Person not found")).toBeInTheDocument();
  });

  it("fails closed when the organization-scoped person lookup is forbidden", async () => {
    await renderRoute("/institution/people/cross-org", {}, "forbidden");
    expect(await screen.findByText("You don't have access to this page")).toBeInTheDocument();
  });
});
