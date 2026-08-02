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
});
