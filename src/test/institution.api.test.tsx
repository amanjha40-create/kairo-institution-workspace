import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

async function importApiModule(demoMode: "true" | "false") {
  vi.resetModules();
  vi.stubEnv("VITE_APP_ENV", "test");
  vi.stubEnv("VITE_DEMO_MODE", demoMode);
  vi.stubEnv("VITE_API_BASE_URL", "");
  return import("@/lib/institution/api");
}

async function importBackendModule() {
  vi.resetModules();
  vi.stubEnv("VITE_APP_ENV", "test");
  vi.stubEnv("VITE_DEMO_MODE", "false");
  vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
  return import("@/lib/institution/backend");
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

  it("normalizes sparse evidence and nested timeline payloads from the institution-scoped contract", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_APP_ENV", "test");
    vi.stubEnv("VITE_DEMO_MODE", "false");
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(typeof input === "string" ? input : input.toString());

      if (
        url.pathname ===
        "/api/v1/organizations/inst_001/institution/verification-requests/vr_001/evidence"
      ) {
        return new Response(
          JSON.stringify({
            public_id: "evidence_001",
            evidence_type: "degree_certificate",
            field_key: "education_evidence",
            document_id: null,
            employment_document_id: null,
            value: null,
            status: "submitted",
            created_at: "2026-08-24T10:00:00Z",
            updated_at: "2026-08-24T10:00:00Z",
            document_type: "degree_certificate",
            original_filename: "Degree Certificate.pdf",
            mime_type: "application/pdf",
            file_size: 2048,
            upload_status: "uploaded",
            download_url: "https://example.com/degree-certificate.pdf",
            download_url_expires_in_seconds: 300,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      if (
        url.pathname ===
        "/api/v1/organizations/inst_001/institution/verification-requests/vr_001/timeline"
      ) {
        return new Response(
          JSON.stringify({
            timeline: {
              verification_request_public_id: "vr_001",
              items: [
                {
                  public_id: "timeline_001",
                  event_type: "admin_finalized",
                  event_source: "admin",
                  previous_status: "pending_admin_quality_review",
                  new_status: "verified",
                  metadata: null,
                  created_at: "2026-08-24T12:19:45.821278Z",
                },
              ],
              total: 1,
              page: 1,
              page_size: 100,
              total_pages: 1,
              offset: 0,
              limit: 100,
            },
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

    const evidence = await backend.getInstitutionVerificationEvidence("inst_001", "vr_001");
    const timeline = await backend.getInstitutionVerificationTimeline("inst_001", "vr_001");

    expect(evidence).toEqual([
      expect.objectContaining({
        id: "evidence_001",
        name: "Degree Certificate.pdf",
        type: "degree_certificate",
      }),
    ]);
    expect(timeline).toEqual([
      expect.objectContaining({
        id: "timeline_001",
        label: "Admin Finalized",
      }),
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/v1/organizations/inst_001/institution/verification-requests/vr_001/evidence",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer access_token_123",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/v1/organizations/inst_001/institution/verification-requests/vr_001/timeline",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer access_token_123",
        }),
      }),
    );
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

  it("uses canonical account settings and session routes without calling obsolete users/me settings paths", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(typeof input === "string" ? input : input.toString());

      if (url.pathname === "/api/v1/account/settings" && init?.method === "GET") {
        return new Response(
          JSON.stringify({
            profile: {
              id: "user_001",
              email: "priya.menon@northbridge.edu",
              full_name: "Priya Menon",
              phone: "+1 555 010 4421",
              current_role: "Registrar",
              location: "Northbridge, NB",
              email_verified_at: "2026-07-10T10:00:00Z",
              phone_verified_at: null,
            },
            notification_preferences: [],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      if (url.pathname === "/api/v1/account/settings" && init?.method === "PATCH") {
        return new Response(
          JSON.stringify({
            profile: {
              id: "user_001",
              email: "priya.menon@northbridge.edu",
              full_name: "Priya Menon",
              phone: "+1 555 010 4421",
              current_role: "Registrar",
              location: "Northbridge, NB",
              email_verified_at: "2026-07-10T10:00:00Z",
              phone_verified_at: null,
            },
            notification_preferences: [
              {
                public_id: "pref_001",
                event_type: "verification_completed",
                enabled: true,
                preferred_channels: ["email"],
              },
            ],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      if (url.pathname === "/api/v1/account/sessions" && init?.method === "GET") {
        return new Response(
          JSON.stringify([
            {
              id: "session_001",
              created_at: "2026-08-24T10:09:53.398450Z",
              expires_at: "2026-08-31T10:09:53.398450Z",
              last_active_at: "2026-08-24T10:19:53.398450Z",
              current: true,
              device: "MacBook Pro",
              browser: "Chrome",
              location: "Northbridge, NB",
            },
          ]),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      if (url.pathname === "/api/v1/account/sessions/session_001" && init?.method === "DELETE") {
        return new Response(null, { status: 204 });
      }

      if (url.pathname === "/api/v1/account/sessions" && init?.method === "DELETE") {
        return new Response(null, { status: 204 });
      }

      return new Response("Not Found", { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);

    const backend = await importBackendModule();
    backend.storeInstitutionAuthTokens({
      accessToken: "access_token_123",
      refreshToken: "refresh_token_123",
      tokenType: "Bearer",
      expiresAt: "2099-01-01T00:00:00.000Z",
    });

    await backend.getInstitutionAccountSettings();
    await backend.updateInstitutionAccountNotificationPreferences([
      {
        event_type: "verification_completed",
        enabled: true,
        preferred_channels: ["email"],
      },
    ]);
    await backend.getInstitutionAccountSessions();
    await backend.revokeInstitutionAccountSession("session_001");
    await backend.revokeAllInstitutionAccountSessions();

    const pathnames = fetchMock.mock.calls.map(
      ([input]) => new URL(typeof input === "string" ? input : input.toString()).pathname,
    );

    expect(pathnames).toContain("/api/v1/account/settings");
    expect(pathnames).toContain("/api/v1/account/sessions");
    expect(pathnames).toContain("/api/v1/account/sessions/session_001");
    expect(pathnames).not.toContain("/api/v1/users/me/account-settings");
    expect(pathnames).not.toContain("/api/v1/users/me/sessions");
  });

  it("keeps account settings not-found responses truthful", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(typeof input === "string" ? input : input.toString());

      if (url.pathname === "/api/v1/account/settings") {
        return new Response(
          JSON.stringify({
            error: { code: "not_found", message: "Not Found" },
          }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      return new Response("Not Found", { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);

    const backend = await importBackendModule();
    backend.storeInstitutionAuthTokens({
      accessToken: "access_token_123",
      refreshToken: "refresh_token_123",
      tokenType: "Bearer",
      expiresAt: "2099-01-01T00:00:00.000Z",
    });

    await expect(backend.getInstitutionAccountSettings()).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });
  });

  it("keeps account session unauthorized responses truthful", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const requestUrl =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const url = new URL(requestUrl);

      if (url.pathname === "/api/v1/account/sessions") {
        return new Response(
          JSON.stringify({
            error: { code: "unauthorized", message: "Session expired" },
          }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      if (url.pathname === "/api/v1/auth/refresh") {
        return new Response(
          JSON.stringify({
            error: { code: "unauthorized", message: "Refresh token expired" },
          }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      return new Response("Not Found", { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);

    const backend = await importBackendModule();
    backend.storeInstitutionAuthTokens({
      accessToken: "access_token_123",
      refreshToken: "refresh_token_123",
      tokenType: "Bearer",
      expiresAt: "2099-01-01T00:00:00.000Z",
    });

    await expect(backend.getInstitutionAccountSessions()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      status: 401,
    });
  });

  it("keeps obsolete users/me account settings routes out of the backend adapter source", async () => {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const backendSource = await readFile(
      join(process.cwd(), "src/lib/institution/backend.ts"),
      "utf8",
    );

    expect(backendSource).toContain('"/api/v1/account/settings"');
    expect(backendSource).toContain('"/api/v1/account/sessions"');
    expect(backendSource).not.toContain("/api/v1/users/me/account-settings");
    expect(backendSource).not.toContain("/api/v1/users/me/sessions");
  });

  it("keeps obsolete generic evidence and timeline routes out of the backend adapter source", async () => {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const backendSource = await readFile(
      join(process.cwd(), "src/lib/institution/backend.ts"),
      "utf8",
    );

    expect(backendSource).toContain(
      "/api/v1/organizations/${orgPublicId}/institution/verification-requests/${requestPublicId}/evidence",
    );
    expect(backendSource).toContain(
      "/api/v1/organizations/${orgPublicId}/institution/verification-requests/${requestPublicId}/timeline",
    );
    expect(backendSource).not.toContain(
      "/api/v1/verification-requests/${requestPublicId}/evidence",
    );
    expect(backendSource).not.toContain(
      "/api/v1/verification-requests/${requestPublicId}/timeline",
    );
  });
});
