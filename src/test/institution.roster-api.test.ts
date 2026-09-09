import { afterEach, describe, expect, it, vi } from "vitest";

const previewPayload = {
  import_id: "import_001",
  roster_type: "student",
  source_format: "csv",
  original_filename: "students.csv",
  state: "ready_for_review",
  mapping: {
    source_columns: [
      { original: "Student ID", normalized: "student_id" },
      { original: "Full Name", normalized: "full_name" },
    ],
    mappings: { student_id: "student_id", full_name: "full_name" },
    unmapped_source_columns: [],
    missing_required_mappings: [],
    ambiguous_mappings: [],
    warnings: [],
  },
  counts: {
    total_rows: 1,
    valid_new: 1,
    valid_update: 0,
    duplicate: 0,
    invalid: 0,
    skipped: 0,
    created: 0,
    updated: 0,
    failed: 0,
  },
  rows: [],
  audit_events: [],
  created_at: "2026-09-09T10:00:00Z",
};

async function importBackend() {
  vi.resetModules();
  vi.stubEnv("VITE_APP_ENV", "test");
  vi.stubEnv("VITE_DEMO_MODE", "false");
  vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
  const backend = await import("@/lib/institution/backend");
  backend.storeInstitutionAuthTokens({
    accessToken: "access_token_123",
    refreshToken: "refresh_token_123",
    tokenType: "bearer",
    expiresAt: "2099-09-09T10:00:00Z",
  });
  return backend;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("institution student roster backend contract", () => {
  it("resolves roster-only detail with the canonical organization-person and import-row IDs", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "Institution person not found" } }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            public_id: "person_001",
            summary: { full_name: "Amina Rahman" },
            organization_relationship: {
              resolution_method: "organization_import",
              resolution_metadata: { source_import_id: "import_001" },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [
              {
                organization_person_id: "person_001",
                roster_type: "student",
                full_name: "Amina Rahman",
                email: "amina@university.edu",
                phone: null,
                roster_data: {
                  student_id: "S-100",
                  program: "Computer Science",
                },
                source_status: "organization_provided",
                verified: false,
                source_import_id: "import_001",
                source_row_number: 2,
                imported_at: "2026-09-09T10:01:00Z",
              },
            ],
            total: 1,
            page: 1,
            page_size: 100,
            total_pages: 1,
            offset: 0,
            limit: 100,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    await importBackend();
    const api = await import("@/lib/institution/api");

    await expect(
      api.getInstitutionPersonDetail("org_001", "person_001", {
        importId: "import_001",
        rowNumber: 2,
      }),
    ).resolves.toMatchObject({
      kind: "organization_roster",
      person: {
        id: "person_001",
        fullName: "Amina Rahman",
        email: "amina@university.edu",
        sourceStatus: "organization_provided",
        verified: false,
        rosterData: { student_id: "S-100", program: "Computer Science" },
      },
    });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://api.example.com/api/v1/organizations/org_001/institution/people/person_001",
      "https://api.example.com/api/v1/organizations/org_001/people/person_001",
      "https://api.example.com/api/v1/organizations/org_001/roster/students?search=Amina+Rahman&page=1&page_size=100",
    ]);
  });

  it("fails closed unless the import row proves the same organization-person ID", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "Institution person not found" } }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            public_id: "person_001",
            summary: { full_name: "Amina Rahman" },
            organization_relationship: {
              resolution_method: "organization_import",
              resolution_metadata: { source_import_id: "import_001" },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [
              {
                organization_person_id: "different_person",
                roster_type: "student",
                full_name: "Amina Rahman",
                roster_data: { student_id: "OTHER" },
                source_status: "organization_provided",
                verified: false,
                source_import_id: "import_001",
                source_row_number: 2,
                imported_at: "2026-09-09T10:01:00Z",
              },
            ],
            total: 1,
            page: 1,
            page_size: 100,
            total_pages: 1,
            offset: 0,
            limit: 100,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    await importBackend();
    const api = await import("@/lib/institution/api");

    await expect(
      api.getInstitutionPersonDetail("org_001", "person_001", {
        importId: "import_001",
        rowNumber: 2,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });

  it("propagates organization-scoped forbidden responses for cross-org detail IDs", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "Institution person not found" } }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "Organization access denied" } }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    await importBackend();
    const api = await import("@/lib/institution/api");

    await expect(
      api.getInstitutionPersonDetail("org_001", "person_other", {
        importId: "cross_org_import",
        rowNumber: 2,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("uploads a student CSV as authenticated multipart data without forcing a JSON content type", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(previewPayload), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const backend = await importBackend();
    const file = new File(["Student ID,Full Name\nS-1,Amina Rahman"], "students.csv", {
      type: "text/csv",
    });

    await expect(backend.uploadInstitutionStudentRoster("org_001", file)).resolves.toMatchObject({
      id: "import_001",
      state: "ready_for_review",
      counts: { validNew: 1 },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/v1/organizations/org_001/roster-imports",
      expect.objectContaining({ method: "POST", body: expect.any(FormData) }),
    );
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(request.headers).toMatchObject({ Authorization: "Bearer access_token_123" });
    expect(request.headers).not.toHaveProperty("Content-Type");
    expect((request.body as FormData).get("roster_type")).toBe("student");
    expect((request.body as FormData).get("file")).toBeInstanceOf(File);
  });

  it("uses the exact mapping and confirmation routes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(previewPayload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ...previewPayload,
            state: "completed",
            counts: { ...previewPayload.counts, valid_new: 0, created: 1 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const backend = await importBackend();

    await backend.updateInstitutionStudentRosterMapping("org_001", "import_001", [
      { sourceColumn: "Student ID", canonicalField: "student_id" },
      { sourceColumn: "Unused", canonicalField: null },
    ]);
    await backend.confirmInstitutionStudentRosterImport("org_001", "import_001");

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.example.com/api/v1/organizations/org_001/roster-imports/import_001/mapping",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          assignments: [
            { source_column: "Student ID", canonical_field: "student_id" },
            { source_column: "Unused", canonical_field: null },
          ],
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.example.com/api/v1/organizations/org_001/roster-imports/import_001/confirm",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("surfaces upload, mapping, and confirmation failures from the backend", async () => {
    const errorResponse = (status: number, message: string) =>
      new Response(JSON.stringify({ error: { message } }), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(403, "Roster imports require an organization manager."))
      .mockResolvedValueOnce(errorResponse(422, "Map a usable student identity field."))
      .mockResolvedValueOnce(errorResponse(409, "This import has already been finalized."));
    vi.stubGlobal("fetch", fetchMock);
    const backend = await importBackend();
    const file = new File(["Student ID,Full Name\nS-1,Amina Rahman"], "students.csv", {
      type: "text/csv",
    });

    await expect(backend.uploadInstitutionStudentRoster("org_001", file)).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
    });
    await expect(
      backend.updateInstitutionStudentRosterMapping("org_001", "import_001", []),
    ).rejects.toMatchObject({ code: "VALIDATION", status: 422 });
    await expect(
      backend.confirmInstitutionStudentRosterImport("org_001", "import_001"),
    ).rejects.toMatchObject({ code: "CONFLICT", status: 409 });
  });

  it("uses server pagination for roster, history, rows, and the backend error CSV", async () => {
    const pageMetadata = { total: 0, page: 1, page_size: 25, total_pages: 0, offset: 0, limit: 25 };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [], ...pageMetadata }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [], ...pageMetadata }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [], ...pageMetadata }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response("row_number,error_code\n2,invalid_email", {
          status: 200,
          headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": 'attachment; filename="roster-errors.csv"',
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const backend = await importBackend();

    await backend.getInstitutionStudentRoster("org_001", {
      search: "amina",
      page: 1,
      pageSize: 25,
    });
    await backend.getInstitutionStudentRosterImports("org_001", { page: 1, pageSize: 25 });
    await backend.getInstitutionStudentRosterImportRows("org_001", "import_001", {
      disposition: "invalid",
      page: 1,
      pageSize: 25,
    });
    const report = await backend.downloadInstitutionStudentRosterErrorReport(
      "org_001",
      "import_001",
    );

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://api.example.com/api/v1/organizations/org_001/roster/students?search=amina&page=1&page_size=25",
      "https://api.example.com/api/v1/organizations/org_001/roster-imports?roster_type=student&page=1&page_size=25",
      "https://api.example.com/api/v1/organizations/org_001/roster-imports/import_001/rows?disposition=invalid&page=1&page_size=25",
      "https://api.example.com/api/v1/organizations/org_001/roster-imports/import_001/errors.csv",
    ]);
    expect(report.filename).toBe("roster-errors.csv");
    expect(await report.blob.text()).toContain("invalid_email");
  });
});
