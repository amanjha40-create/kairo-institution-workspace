import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import {
  beginStudentRosterConfirmation,
  buildStudentRosterMappingAssignments,
  validateStudentRosterFile,
} from "@/lib/institution/roster";
import { renderInstitutionRoute } from "@/test/router-test-utils";

const counts = {
  totalRows: 5,
  validNew: 1,
  validUpdate: 1,
  duplicate: 1,
  invalid: 1,
  skipped: 1,
  created: 0,
  updated: 0,
  failed: 0,
};

const rows = [
  {
    rowNumber: 2,
    rawValues: { "Student ID": "S-100", "Full Name": "Amina Rahman" },
    normalizedValues: {
      student_id: "S-100",
      full_name: "Amina Rahman",
      institutional_email: "amina@university.edu",
      program: "Computer Science",
      degree: "Bachelor of Science",
      department: "Engineering",
      enrollment_status: "current",
    },
    disposition: "valid_new" as const,
    validationErrors: [],
    applicationStatus: "pending" as const,
    applicationErrors: [],
  },
  {
    rowNumber: 4,
    rawValues: { "Student ID": "S-101", "Full Name": "Existing Student" },
    normalizedValues: { student_id: "S-101", full_name: "Existing Student" },
    disposition: "valid_update" as const,
    validationErrors: [],
    applicationStatus: "pending" as const,
    applicationErrors: [],
  },
  {
    rowNumber: 5,
    rawValues: { "Student ID": "S-100", "Full Name": "Duplicate Student" },
    normalizedValues: { student_id: "S-100", full_name: "Duplicate Student" },
    disposition: "duplicate" as const,
    validationErrors: [
      {
        code: "duplicate_student_id",
        field: "student_id",
        message: "Duplicate student ID",
        rowNumber: 5,
      },
    ],
    applicationStatus: "ignored" as const,
    applicationErrors: [],
  },
  {
    rowNumber: 6,
    rawValues: { "Student ID": "S-102", "Full Name": "Skipped Student" },
    normalizedValues: { student_id: "S-102", full_name: "Skipped Student" },
    disposition: "skipped" as const,
    validationErrors: [],
    applicationStatus: "ignored" as const,
    applicationErrors: [],
  },
  {
    rowNumber: 3,
    rawValues: { "Student ID": "", "Full Name": "Incomplete Student" },
    normalizedValues: { full_name: "Incomplete Student" },
    disposition: "invalid" as const,
    validationErrors: [
      {
        code: "missing_identity",
        field: "student_id",
        message: "Missing student ID / roll number / institutional email",
        rowNumber: 3,
      },
    ],
    applicationStatus: "pending" as const,
    applicationErrors: [],
  },
];

function importDetail(
  state: "mapping_required" | "ready_for_review" | "completed_with_errors" | "failed",
) {
  return {
    id: "import_001",
    sourceFormat: "csv",
    originalFilename: "students.csv",
    state,
    mapping: {
      sourceColumns: [
        { original: "Student ID", normalized: "student_id" },
        { original: "Full Name", normalized: "full_name" },
        { original: "Notes", normalized: "notes" },
      ],
      mappings:
        state === "mapping_required"
          ? { full_name: "full_name" }
          : { student_id: "student_id", full_name: "full_name" },
      unmappedSourceColumns: state === "mapping_required" ? ["student_id", "notes"] : ["notes"],
      missingRequiredMappings: state === "mapping_required" ? ["identity"] : [],
      ambiguousMappings: [],
      warnings: [],
    },
    counts:
      state === "completed_with_errors"
        ? { ...counts, validNew: 0, validUpdate: 0, created: 1, updated: 1, failed: 1 }
        : counts,
    rows,
    uploader: {
      userId: "user_001",
      displayName: "Institution Owner",
      email: "owner@university.edu",
    },
    auditEvents: [],
    confirmedAt: state === "completed_with_errors" ? "2026-09-09T10:05:00Z" : null,
    completedAt: state === "completed_with_errors" ? "2026-09-09T10:06:00Z" : null,
    createdAt: "2026-09-09T10:00:00Z",
  };
}

function session(role: "owner" | "admin" | "reviewer" = "owner") {
  return {
    userId: "user_001",
    membershipId: "membership_001",
    institutionId: "org_001",
    name: "Institution User",
    email: "user@university.edu",
    role,
    institutionName: "Example University",
    accountStatus: "active" as const,
    workspaceStatus: "active" as const,
    expiresAt: "2099-09-09T10:00:00Z",
  };
}

async function renderRosterRoute(
  path: string,
  options: {
    role?: "owner" | "admin" | "reviewer";
    detail?: ReturnType<typeof importDetail>;
    demoMode?: boolean;
    api?: Record<string, ReturnType<typeof vi.fn>>;
  } = {},
) {
  vi.resetModules();
  vi.stubEnv("VITE_APP_ENV", "test");
  vi.stubEnv("VITE_DEMO_MODE", "false");
  vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
  const detail = options.detail ?? importDetail("ready_for_review");
  const api = {
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
      items: [],
      total: 0,
      page: 1,
      pageSize: 25,
      totalPages: 0,
      offset: 0,
      limit: 25,
    }),
    getInstitutionStudentRosterDirectory: vi.fn().mockResolvedValue({
      items: [
        {
          id: "person_001",
          fullName: "Amina Rahman",
          email: "amina@university.edu",
          rosterData: {
            student_id: "S-100",
            program: "Computer Science",
            degree: "Bachelor of Science",
            department: "Engineering",
            enrollment_status: "current",
          },
          sourceStatus: "organization_provided",
          verified: false,
          importedAt: "2026-09-09T10:00:00Z",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 25,
      totalPages: 1,
      offset: 0,
      limit: 25,
    }),
    uploadInstitutionStudentRosterFile: vi.fn().mockResolvedValue(detail),
    getInstitutionStudentRosterImportDetail: vi.fn().mockResolvedValue(detail),
    getInstitutionStudentRosterRows: vi.fn().mockResolvedValue({
      items: rows,
      total: rows.length,
      page: 1,
      pageSize: 25,
      totalPages: 1,
      offset: 0,
      limit: 25,
    }),
    saveInstitutionStudentRosterMapping: vi
      .fn()
      .mockResolvedValue(importDetail("ready_for_review")),
    confirmInstitutionStudentRoster: vi
      .fn()
      .mockResolvedValue(importDetail("completed_with_errors")),
    getInstitutionStudentRosterImportHistory: vi.fn().mockResolvedValue({
      items: [
        {
          id: "import_001",
          sourceFormat: "csv",
          originalFilename: "students.csv",
          state: "completed_with_errors",
          counts: { ...counts, created: 1, updated: 1, failed: 1 },
          uploader: {
            userId: "user_001",
            displayName: "Institution Owner",
            email: "owner@university.edu",
          },
          completedAt: "2026-09-09T10:06:00Z",
          createdAt: "2026-09-09T10:00:00Z",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 25,
      totalPages: 1,
      offset: 0,
      limit: 25,
    }),
    getInstitutionStudentRosterErrorReport: vi.fn().mockResolvedValue({
      blob: new Blob(["error"]),
      filename: "errors.csv",
    }),
    ...options.api,
  };

  vi.doMock("@/lib/institution/api", () => api);
  vi.doMock("@/lib/institution/auth", () => ({
    InstitutionAuthProvider: ({ children }: { children: ReactNode }) => children,
    useInstitutionAuth: () => ({
      session: session(options.role),
      bootstrap: null,
      authenticated: true,
      error: null,
      hydrated: true,
      isDemoMode: options.demoMode ?? false,
      signIn: vi.fn(),
      signOut: vi.fn(),
      refreshSession: vi.fn(),
      requestPasswordReset: vi.fn(),
      completePasswordReset: vi.fn(),
    }),
  }));

  const result = await renderInstitutionRoute(path);
  return { ...result, api };
}

describe("institution student roster import", () => {
  it("shows the People entry point to Owners", async () => {
    await renderRosterRoute("/institution/people");
    expect(await screen.findByRole("link", { name: "Import Students" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Student roster" })).toBeInTheDocument();
  });

  it("shows the People entry point to Admins", async () => {
    await renderRosterRoute("/institution/people", { role: "admin" });
    expect(await screen.findByRole("link", { name: "Import Students" })).toBeInTheDocument();
  });

  it("denies direct roster import access to Reviewers", async () => {
    await renderRosterRoute("/institution/people/students/import", { role: "reviewer" });
    expect(await screen.findByText("You don't have access to this page")).toBeInTheDocument();
  });

  it("keeps student imports unavailable in explicit Demo Mode without backend calls", async () => {
    const { api } = await renderRosterRoute("/institution/people/students/import", {
      demoMode: true,
    });
    expect(
      await screen.findByText("Student import is unavailable in Demo Mode"),
    ).toBeInTheDocument();
    expect(api.uploadInstitutionStudentRosterFile).not.toHaveBeenCalled();
  });

  it("renders organization-provided students without calling them verified", async () => {
    await renderRosterRoute("/institution/people/students");
    expect(await screen.findByRole("heading", { name: "Student roster" })).toBeInTheDocument();
    expect(screen.getAllByText("Organization-provided").length).toBeGreaterThan(0);
    expect(screen.queryByText(/^Verified$/)).not.toBeInTheDocument();
  });

  it("validates files and exposes the upload affordances", async () => {
    expect(validateStudentRosterFile(new File(["bad"], "students.txt"))).toBe(
      "Choose a CSV or XLSX file.",
    );
    const csv = new File(["Student ID,Full Name\nS-100,Amina Rahman"], "students.csv", {
      type: "text/csv",
    });
    expect(validateStudentRosterFile(csv)).toBeNull();
    expect(
      validateStudentRosterFile(
        new File(["workbook"], "students.xlsx", {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      ),
    ).toBeNull();
    expect(validateStudentRosterFile(new File([], "students.csv"))).toBe(
      "The selected file is empty.",
    );
    expect(
      validateStudentRosterFile(
        new File([new Uint8Array(5_000_001)], "students.csv", { type: "text/csv" }),
      ),
    ).toBe("The file must be 5 MB or smaller.");
    expect(validateStudentRosterFile(new File(["data"], `${"a".repeat(252)}.csv`))).toBe(
      "The filename must be 255 characters or fewer.",
    );

    await renderRosterRoute("/institution/people/students/import");
    expect(await screen.findByRole("heading", { name: "Import Students" })).toBeInTheDocument();
    expect(screen.getByLabelText("Choose a CSV or XLSX file")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Download template" })).toHaveAttribute(
      "href",
      "/templates/kairo-student-roster-template.csv",
    );
  });

  it("shows backend preview counts, row dispositions, and structured row errors", async () => {
    await renderRosterRoute("/institution/people/students/import/import_001");
    expect(await screen.findByRole("heading", { name: "Preview summary" })).toBeInTheDocument();
    expect(screen.getAllByText("New").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Update").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Duplicate").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Invalid").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Skipped").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/Missing student ID \/ roll number \/ institutional email/).length,
    ).toBeGreaterThan(0);
  });

  it("blocks confirmation while required identity mapping is incomplete", async () => {
    await renderRosterRoute("/institution/people/students/import/import_001", {
      detail: importDetail("mapping_required"),
    });
    expect(
      await screen.findByText("Map Student ID, Roll Number, or Institution Email."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import Students" })).toBeDisabled();
    expect(screen.getByText("Auto-mapped")).toBeInTheDocument();
  });

  it("builds manual and ignored mapping assignments for the backend", () => {
    expect(
      buildStudentRosterMappingAssignments(
        [
          { original: "Student ID", normalized: "student_id" },
          { original: "Notes", normalized: "notes" },
        ],
        { student_id: "student_id", notes: null },
      ),
    ).toEqual([
      { sourceColumn: "Student ID", canonicalField: "student_id" },
      { sourceColumn: "Notes", canonicalField: null },
    ]);
  });

  it("prevents duplicate confirmation and renders the backend result", async () => {
    const confirmationGuard = { current: false };
    expect(beginStudentRosterConfirmation(confirmationGuard)).toBe(true);
    expect(beginStudentRosterConfirmation(confirmationGuard)).toBe(false);

    await renderRosterRoute("/institution/people/students/import/import_001", {
      detail: importDetail("completed_with_errors"),
    });
    expect(
      await screen.findByRole("heading", { name: "Import completed with issues" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Students" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download Error Report" })).toBeInTheDocument();
  });

  it("renders the backend failure state without presenting a confirm action", async () => {
    const failed = {
      ...importDetail("completed_with_errors"),
      state: "failed" as const,
      failureMessage: "The backend could not apply this import.",
    };
    await renderRosterRoute("/institution/people/students/import/import_001", { detail: failed });
    expect(
      await screen.findByRole("heading", { name: "Import could not be completed" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("The backend could not apply this import.").length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByRole("button", { name: "Import Students" })).not.toBeInTheDocument();
  });

  it("renders backend import history with uploader, status, and counts", async () => {
    await renderRosterRoute("/institution/people/students/import/history");
    expect(
      await screen.findByRole("heading", { name: "Student Import History" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("students.csv").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Institution Owner").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Completed with issues").length).toBeGreaterThan(0);
  });

  it("renders an honest empty state for import history", async () => {
    await renderRosterRoute("/institution/people/students/import/history", {
      api: {
        getInstitutionStudentRosterImportHistory: vi.fn().mockResolvedValue({
          items: [],
          total: 0,
          page: 1,
          pageSize: 25,
          totalPages: 0,
          offset: 0,
          limit: 25,
        }),
      },
    });
    expect(await screen.findByText("No student imports yet")).toBeInTheDocument();
  });

  it("renders an honest error state for import history", async () => {
    await renderRosterRoute("/institution/people/students/import/history", {
      api: {
        getInstitutionStudentRosterImportHistory: vi
          .fn()
          .mockRejectedValue(new Error("backend unavailable")),
      },
    });
    expect(await screen.findByText("Something went wrong")).toBeInTheDocument();
  });
});
