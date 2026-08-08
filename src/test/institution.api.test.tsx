import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

async function importApiModule(demoMode: "true" | "false") {
  vi.resetModules();
  vi.stubEnv("VITE_APP_ENV", "test");
  vi.stubEnv("VITE_DEMO_MODE", demoMode);
  vi.stubEnv("VITE_API_BASE_URL", "");
  return import("@/lib/institution/api");
}

describe("institution repositories and public verification flows", () => {
  it("distinguishes not shared from not available", async () => {
    const { ProfessionalInfoValue } =
      await import("@/components/institution/ProfessionalInfoValue");
    const { rerender } = render(<ProfessionalInfoValue consented={false} />);

    expect(screen.getByText("Not shared")).toBeInTheDocument();

    rerender(<ProfessionalInfoValue consented value={undefined} />);
    expect(screen.getByText("Not available")).toBeInTheDocument();
  });

  it("protects the final active owner from removal", async () => {
    const api = await importApiModule("true");

    await expect(api.removeTeamMember("inst_northbridge", "u_priya")).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("splits current members from pending invitations in demo mode", async () => {
    const api = await importApiModule("true");

    await expect(api.getInstitutionTeam("inst_northbridge")).resolves.toMatchObject({
      members: expect.arrayContaining([
        expect.objectContaining({ id: "u_priya", role: "owner", status: "active" }),
      ]),
      invitations: expect.arrayContaining([
        expect.objectContaining({ id: "u_marcus", role: "reviewer", status: "pending" }),
      ]),
    });
  });

  it("returns expired, completed, revoked, and invalid magic-link states", async () => {
    const api = await importApiModule("true");

    await expect(
      api.getPublicInstitutionVerificationByToken("expired-token"),
    ).resolves.toMatchObject({
      state: "expired",
    });
    await expect(
      api.getPublicInstitutionVerificationByToken("completed-token"),
    ).resolves.toMatchObject({
      state: "completed",
    });
    await expect(
      api.getPublicInstitutionVerificationByToken("revoked-token"),
    ).resolves.toMatchObject({
      state: "revoked",
    });
    await expect(
      api.getPublicInstitutionVerificationByToken("missing-token"),
    ).resolves.toMatchObject({
      state: "invalid",
    });
  });

  it("prevents double submission of a magic-link confirmation", async () => {
    const api = await importApiModule("true");

    await expect(
      api.confirmPublicInstitutionVerification("valid-token", {
        note: "Matches institution record",
      }),
    ).resolves.toMatchObject({
      state: "completed",
    });

    await expect(
      api.confirmPublicInstitutionVerification("valid-token", { note: "Second attempt" }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("supports confirm, discrepancy, and clarification in demo mode and fails closed in production", async () => {
    let api = await importApiModule("true");
    await expect(
      api.confirmPublicInstitutionVerification("valid-token", { note: "Confirmed" }),
    ).resolves.toMatchObject({
      state: "completed",
    });

    api = await importApiModule("true");
    await expect(
      api.reportPublicInstitutionVerificationDiscrepancy("valid-token", {
        fields: ["Degree"],
        explanation: "Degree differs from institution record.",
      }),
    ).resolves.toMatchObject({
      state: "completed",
    });

    api = await importApiModule("true");
    await expect(
      api.requestPublicInstitutionVerificationClarification("valid-token", {
        fields: ["Supporting document"],
        message: "Please share your official transcript.",
        requestDocument: true,
      }),
    ).resolves.toMatchObject({
      state: "completed",
    });

    api = await importApiModule("false");
    await expect(
      api.confirmPublicInstitutionVerification("valid-token", { note: "Confirmed" }),
    ).rejects.toMatchObject({
      code: "API_NOT_CONFIGURED",
    });
  });

  it("keeps candidate claim fields honest when the backend omits department data", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_APP_ENV", "test");
    vi.stubEnv("VITE_DEMO_MODE", "false");
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          public_id: "vr_001",
          subject_name: "Amina Rahman",
          request_type: "education",
          status: "pending_organization_resolution",
          priority: "high",
          due_date: "2026-08-07T10:00:00Z",
          created_at: "2026-08-01T10:00:00Z",
          updated_at: "2026-08-02T10:00:00Z",
          assigned_reviewer_name: "Daniel Okafor",
          education_institution_name: "Northbridge University",
          education_degree: "Bachelor of Science",
          organization_internal_note: "Check graduation month.",
          candidate_response: "Submitted transcript and completion letter.",
          candidate_response_submitted_at: "2026-08-01T12:00:00Z",
          consented_fields: ["degree", "graduation_year"],
          consented_evidence_scope: ["transcript"],
          comparison: {
            match_status: "partial",
            candidate_claim: {
              institution_name: "Northbridge University",
              degree: "Bachelor of Science",
              programme: "Computer Science",
              admission: { period: "2020", date: null },
              graduation: { period: "2024", date: null },
            },
            institution_record: {
              found: true,
              student_id: "NB-2020-014",
              degree: "Bachelor of Science",
              programme: "Computer Science",
              department: "Engineering",
              admission: { period: "2020", date: "2020-08-15" },
              graduation: { period: "2024", date: "2024-06-15" },
              verification_status: "verified",
            },
            fields: [
              {
                key: "degree",
                candidate_value: "Bachelor of Science",
                institution_value: "Bachelor of Science",
                outcome: "match",
              },
            ],
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    const backend = await import("@/lib/institution/backend");
    backend.storeInstitutionAuthTokens({
      accessToken: "access_token_123",
      refreshToken: "refresh_token_123",
      tokenType: "Bearer",
      expiresAt: "2099-01-01T00:00:00.000Z",
    });

    const detail = await backend.getInstitutionVerificationRequestDetail("inst_001", "vr_001");

    expect(detail.claim.department).toBe("—");
    expect(detail.institutionRecord.department).toBe("Engineering");
  });

  it("prefers the typed education_claim contract over trust_context parsing", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_APP_ENV", "test");
    vi.stubEnv("VITE_DEMO_MODE", "false");
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          public_id: "vr_edu_001",
          employment_id: null,
          education_id: "edu_001",
          origin_type: "subject_initiated",
          organization_public_id: "inst_001",
          trust_invitation_public_id: null,
          subject_name: "Amina Rahman",
          subject_email: "amina.rahman@example.com",
          target_organization_name: "Northbridge University",
          target_organization_email: "records@northbridge.edu",
          request_type: "education",
          status: "pending_organization_resolution",
          priority: "urgent",
          due_date: "2026-08-12",
          trust_context: {
            degree: "Wrong Degree",
            institution_name: "Wrong University",
            field_of_study: "Wrong Programme",
            graduation_year: "2099",
          },
          created_at: "2026-08-01T10:00:00Z",
          updated_at: "2026-08-02T10:00:00Z",
          candidate_response: "Shared transcript.",
          candidate_response_submitted_at: "2026-08-01T12:00:00Z",
          accepted_at: "2026-08-01T11:00:00Z",
          consented_fields: ["degree"],
          consented_evidence_scope: ["transcript"],
          target_organization_metadata: {},
          education_claim: {
            institution_name: "Northbridge University",
            degree: "Bachelor of Science",
            field_of_study: "Computer Science",
            start_date: "2020-08-15",
            end_date: "2024-06-15",
          },
          evidence_summary: {
            total_items: 1,
            document_items: 1,
            field_keys: ["transcript"],
          },
          assigned_reviewer: null,
          review_status: null,
          is_assigned_to_current_user: false,
          organization_internal_note: null,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    const backend = await import("@/lib/institution/backend");
    backend.storeInstitutionAuthTokens({
      accessToken: "access_token_123",
      refreshToken: "refresh_token_123",
      tokenType: "Bearer",
      expiresAt: "2099-01-01T00:00:00.000Z",
    });

    const request = await backend.verifyInstitutionVerificationRequest("vr_edu_001", {
      note: "Matches institution record.",
    });

    expect(request.priority).toBe("urgent");
    expect(request.claim.institutionName).toBe("Northbridge University");
    expect(request.claim.degree).toBe("Bachelor of Science");
    expect(request.claim.programme).toBe("Computer Science");
    expect(request.claim.admissionYear).toBe("2020");
    expect(request.claim.graduationYear).toBe("2024");
  });

  it("falls back to authoritative verification and people totals when the dedicated dashboard endpoint is unavailable", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_APP_ENV", "test");
    vi.stubEnv("VITE_DEMO_MODE", "false");
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");

    const verificationTotals: Record<string, number> = {
      all: 9,
      pending: 1,
      draft: 0,
      pending_subject_acceptance: 0,
      accepted: 1,
      pending_subject_submission: 0,
      pending_admin_review: 0,
      pending_admin_re_review: 0,
      pending_organization_acceptance: 0,
      in_progress: 1,
      approved_for_organization_verification: 0,
      pending_organization_resolution: 1,
      awaiting_information: 1,
      awaiting_clarification: 1,
      verified: 2,
      confirmed: 1,
      high: 1,
      urgent: 1,
    };
    const peopleTotals: Record<string, number> = {
      all: 12,
      current_student: 5,
      alumni: 4,
      withdrawn: 2,
      inactive: 1,
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(typeof input === "string" ? input : input.toString());

      if (url.pathname.endsWith("/institution/dashboard")) {
        return new Response(
          JSON.stringify({ error: { code: "not_found", message: "Not Found" } }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      if (url.pathname.endsWith("/verification-requests")) {
        const status = url.searchParams.get("status");
        const priority = url.searchParams.get("priority");
        const total = priority
          ? (verificationTotals[priority] ?? 0)
          : status
            ? (verificationTotals[status] ?? 0)
            : verificationTotals.all;

        return new Response(
          JSON.stringify({
            items: [],
            total,
            page: 1,
            page_size: 1,
            total_pages: total === 0 ? 0 : 1,
            offset: 0,
            limit: 1,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      if (url.pathname.endsWith("/institution/people")) {
        const lifecycleStatus = url.searchParams.get("lifecycle_status");
        const total = lifecycleStatus ? (peopleTotals[lifecycleStatus] ?? 0) : peopleTotals.all;

        return new Response(
          JSON.stringify({
            items: [],
            total,
            page: 1,
            page_size: 1,
            total_pages: total === 0 ? 0 : 1,
            offset: 0,
            limit: 1,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      return new Response("Not Found", { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);

    const backend = await import("@/lib/institution/backend");
    backend.storeInstitutionAuthTokens({
      accessToken: "access_token_123",
      refreshToken: "refresh_token_123",
      tokenType: "Bearer",
      expiresAt: "2099-01-01T00:00:00.000Z",
    });

    const dashboard = await backend.getInstitutionDashboard("inst_001");

    expect(dashboard.pendingVerifications).toBe(6);
    expect(dashboard.statistics.totalVerifications).toBe(9);
    expect(dashboard.statistics.verifiedVerifications).toBe(3);
    expect(dashboard.statistics.awaitingInformation).toBe(2);
    expect(dashboard.statistics.highPriority).toBe(2);
    expect(dashboard.people).toEqual({
      total: 12,
      currentStudent: 5,
      alumni: 4,
      withdrawn: 2,
      inactive: 1,
    });
    expect(dashboard.verificationActivityAvailable).toBe(false);
    expect(dashboard.recentlyVerifiedCredentialsAvailable).toBe(false);
  });
});
