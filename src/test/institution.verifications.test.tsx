import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { renderInstitutionRoute } from "@/test/router-test-utils";
import { serviceUnavailableError } from "@/lib/institution/errors";

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

function buildVerificationRequest(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: "vr_001",
    reference: "VR-001",
    candidateName: "Amina Rahman",
    candidateId: "candidate_001",
    requestedBy: "Northbridge University",
    requestPurpose: "Education verification request",
    status: "pending_organization_resolution",
    priority: "urgent",
    receivedAt: "2026-07-24T10:00:00Z",
    dueAt: "2026-07-29T10:00:00Z",
    assignedTo: "Daniel Okafor",
    nextAction: "Review and respond",
    consentReceived: true,
    claim: {
      candidateName: "Amina Rahman",
      studentId: "NB-2020-014",
      institutionName: "Northbridge University",
      degree: "Bachelor of Science",
      programme: "Computer Science",
      department: "Engineering",
      admissionYear: "2020",
      graduationYear: "2024",
      completionStatus: "Completed",
      additionalNote: "Candidate shared transcript and completion letter.",
    },
    institutionRecord: {
      found: true,
      studentId: "NB-2020-014",
      degree: "Bachelor of Science",
      programme: "Computer Science",
      department: "Engineering",
      admissionDate: "2020-08-15",
      graduationDate: "2024-06-15",
      completionStatus: "verified",
      credentialIssuanceStatus: "verified",
    },
    matchStatus: "exact",
    fieldMatches: {
      degree: "match",
      programme: "match",
    },
    evidence: [],
    internalNotes: [],
    timeline: [],
    source: "backend",
    requestType: "education",
    organizationInternalNote: "Confirm graduation month before response.",
    consentedFields: ["degree", "graduation_year"],
    ...overrides,
  };
}

type VerificationApi = {
  getInstitutionNotifications: ReturnType<typeof vi.fn>;
  markInstitutionNotificationRead: ReturnType<typeof vi.fn>;
  markAllInstitutionNotificationsRead: ReturnType<typeof vi.fn>;
  getInstitutionOrganizationVerificationRequests: ReturnType<typeof vi.fn>;
  getInstitutionVerificationRequest: ReturnType<typeof vi.fn>;
  getInstitutionVerificationEvidenceItems: ReturnType<typeof vi.fn>;
  getInstitutionVerificationTimelineItems: ReturnType<typeof vi.fn>;
  getInstitutionTeam: ReturnType<typeof vi.fn>;
  assignInstitutionVerificationRequestReviewer: ReturnType<typeof vi.fn>;
  requestInstitutionClarification: ReturnType<typeof vi.fn>;
  respondToInstitutionVerification: ReturnType<typeof vi.fn>;
  addInternalNote: ReturnType<typeof vi.fn>;
};

function buildVerificationApi(): VerificationApi {
  return {
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
    getInstitutionOrganizationVerificationRequests: vi.fn().mockResolvedValue({
      items: [
        {
          id: "vr_001",
          reference: "VR-001",
          candidateName: "Amina Rahman",
          candidateId: "candidate_001",
          candidateEmail: "amina.rahman@example.com",
          requestedBy: "Northbridge University",
          requestPurpose: "Education verification request",
          status: "pending_organization_resolution",
          priority: "high",
          receivedAt: "2026-07-24T10:00:00Z",
          dueAt: "2026-07-29T10:00:00Z",
          assignedTo: "Daniel Okafor",
          nextAction: "Review and respond",
          consentReceived: true,
          claim: {
            candidateName: "Amina Rahman",
            institutionName: "Northbridge University",
            degree: "Bachelor of Science",
            programme: "Computer Science",
            department: "Engineering",
            admissionYear: "2020",
            graduationYear: "2024",
            completionStatus: "Completed",
          },
          institutionRecord: { found: false },
          matchStatus: "record_unavailable",
          evidence: [],
          internalNotes: [],
          timeline: [],
          source: "backend",
          requestType: "education",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 25,
      totalPages: 1,
      offset: 0,
      limit: 25,
    }),
    getInstitutionVerificationRequest: vi.fn().mockResolvedValue(buildVerificationRequest()),
    getInstitutionVerificationEvidenceItems: vi.fn().mockResolvedValue([
      {
        id: "evidence_001",
        name: "Transcript.pdf",
        type: "transcript",
        uploadedBy: "Request subject",
        uploadedAt: "2026-07-24T09:00:00Z",
        url: "https://example.com/transcript.pdf",
      },
    ]),
    getInstitutionVerificationTimelineItems: vi.fn().mockResolvedValue([
      {
        id: "timeline_001",
        at: "2026-07-24T10:30:00Z",
        label: "Request routed to institution",
        detail: "Assigned for institutional verification",
      },
    ]),
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
      invitations: [],
    }),
    assignInstitutionVerificationRequestReviewer: vi.fn(),
    requestInstitutionClarification: vi.fn(),
    respondToInstitutionVerification: vi.fn(),
    addInternalNote: vi.fn(),
  };
}

async function renderRoute(path: string, customize?: (verificationApi: VerificationApi) => void) {
  vi.resetModules();
  vi.stubEnv("VITE_APP_ENV", "test");
  vi.stubEnv("VITE_DEMO_MODE", "false");
  vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");

  const verificationApi = buildVerificationApi();
  customize?.(verificationApi);

  vi.doMock("@/lib/institution/api", () => verificationApi);
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

  return verificationApi;
}

describe("institution verification routes", () => {
  it("renders the verification inbox from the backend adapter", async () => {
    const verificationApi = await renderRoute("/institution/verifications");

    expect(
      await screen.findByRole("heading", { name: "Verification Requests" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Amina Rahman").length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        /Verification summary cards are hidden until the backend exposes authoritative aggregate metadata/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("high")).toBeInTheDocument();
    expect(screen.getAllByText("Daniel Okafor").length).toBeGreaterThan(0);
    expect(verificationApi.getInstitutionOrganizationVerificationRequests).toHaveBeenCalledTimes(1);
    expect(verificationApi.getInstitutionOrganizationVerificationRequests).toHaveBeenCalledWith(
      "inst_northbridge",
      expect.objectContaining({ pageSize: 25, sortBy: "created_at" }),
    );
  }, 10_000);

  it("renders backend detail data and uses the institution comparison contract", async () => {
    const verificationApi = await renderRoute("/institution/verifications/vr_001");

    expect(await screen.findByText("Candidate-submitted claim")).toBeInTheDocument();
    expect(screen.getByText("Exact Match")).toBeInTheDocument();
    expect(screen.getByText("Transcript.pdf")).toBeInTheDocument();
    expect(screen.getByText("Confirm graduation month before response.")).toBeInTheDocument();
    expect(verificationApi.getInstitutionVerificationRequest).toHaveBeenCalledWith(
      "inst_northbridge",
      "vr_001",
    );
    expect(verificationApi.getInstitutionVerificationEvidenceItems).toHaveBeenCalledWith(
      "inst_northbridge",
      "vr_001",
    );
    expect(verificationApi.getInstitutionVerificationTimelineItems).toHaveBeenCalledWith(
      "inst_northbridge",
      "vr_001",
    );
  });

  it("renders verified evidence and canonical timeline events", async () => {
    await renderRoute("/institution/verifications/vr_001", (verificationApi) => {
      verificationApi.getInstitutionVerificationRequest.mockResolvedValue(
        buildVerificationRequest({
          status: "verified",
          priority: "normal",
          nextAction: "Complete",
        }),
      );
      verificationApi.getInstitutionVerificationEvidenceItems.mockResolvedValue([
        {
          id: "evidence_001",
          name: "Degree Certificate.pdf",
          type: "degree_certificate",
          uploadedBy: "Request subject",
          uploadedAt: "2026-07-24T09:00:00Z",
          url: "https://example.com/degree-certificate.pdf",
        },
      ]);
      verificationApi.getInstitutionVerificationTimelineItems.mockResolvedValue([
        {
          id: "timeline_001",
          at: "2026-07-24T10:00:00Z",
          label: "Request started",
        },
        {
          id: "timeline_002",
          at: "2026-07-24T11:00:00Z",
          label: "Institution response recorded",
        },
        {
          id: "timeline_003",
          at: "2026-07-24T12:00:00Z",
          label: "Pending admin quality review",
        },
        {
          id: "timeline_004",
          at: "2026-07-24T13:00:00Z",
          label: "Admin finalized as verified",
        },
      ]);
    });

    expect(await screen.findByText("Verified")).toBeInTheDocument();
    expect(screen.getByText("Degree Certificate.pdf")).toBeInTheDocument();
    expect(screen.getByText("Request started")).toBeInTheDocument();
    expect(screen.getByText("Admin finalized as verified")).toBeInTheDocument();
  });

  it("renders truthful empty states when evidence and timeline are sparse", async () => {
    await renderRoute("/institution/verifications/vr_001", (verificationApi) => {
      verificationApi.getInstitutionVerificationEvidenceItems.mockResolvedValue([]);
      verificationApi.getInstitutionVerificationTimelineItems.mockResolvedValue([]);
    });

    expect(
      await screen.findByText("No evidence has been shared for this request yet."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("No activity has been recorded for this request yet."),
    ).toBeInTheDocument();
  });

  it("renders real error states when evidence and timeline requests fail", async () => {
    await renderRoute("/institution/verifications/vr_001", (verificationApi) => {
      verificationApi.getInstitutionVerificationEvidenceItems.mockRejectedValue(
        serviceUnavailableError("Evidence temporarily unavailable."),
      );
      verificationApi.getInstitutionVerificationTimelineItems.mockRejectedValue(
        serviceUnavailableError("Timeline temporarily unavailable."),
      );
    });

    expect(await screen.findByText("Evidence could not be loaded right now.")).toBeInTheDocument();
    expect(screen.getByText("Activity could not be loaded right now.")).toBeInTheDocument();
  });

  it("keeps pending admin review requests actionable", async () => {
    await renderRoute("/institution/verifications/vr_001", (verificationApi) => {
      verificationApi.getInstitutionVerificationRequest.mockResolvedValue(
        buildVerificationRequest({
          status: "pending_admin_quality_review",
          priority: "high",
          nextAction: "Await final review",
        }),
      );
    });

    expect(await screen.findByText("Pending Admin Quality Review")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /verify/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reject/i })).toBeInTheDocument();
  });
});
