import type {
  StudentRosterImportCounts,
  StudentRosterImportRow,
  StudentRosterImportState,
  StudentRosterMappingAssignment,
  StudentRosterSourceColumn,
} from "./types";

export const STUDENT_ROSTER_MAX_FILE_BYTES = 5_000_000;
export const STUDENT_ROSTER_TEMPLATE_PATH = "/templates/kairo-student-roster-template.csv";

export const studentRosterCanonicalFields = [
  { value: "student_id", label: "Student ID" },
  { value: "roll_number", label: "Roll Number" },
  { value: "full_name", label: "Full Name" },
  { value: "first_name", label: "First Name" },
  { value: "last_name", label: "Last Name" },
  { value: "institutional_email", label: "Institution Email" },
  { value: "phone", label: "Phone" },
  { value: "degree", label: "Degree" },
  { value: "program", label: "Program" },
  { value: "specialization", label: "Specialization" },
  { value: "department", label: "Department" },
  { value: "admission_date", label: "Admission Date" },
  { value: "graduation_date", label: "Graduation Date" },
  { value: "enrollment_status", label: "Enrollment Status" },
  { value: "campus", label: "Campus" },
  { value: "cohort", label: "Cohort" },
] as const;

export const terminalStudentRosterImportStates = new Set<StudentRosterImportState>([
  "completed",
  "completed_with_errors",
  "failed",
]);

export function validateStudentRosterFile(file: File) {
  if (file.name.length > 255) {
    return "The filename must be 255 characters or fewer.";
  }
  if (!/\.(csv|xlsx)$/i.test(file.name)) {
    return "Choose a CSV or XLSX file.";
  }
  if (file.size > STUDENT_ROSTER_MAX_FILE_BYTES) {
    return "The file must be 5 MB or smaller.";
  }
  if (file.size === 0) {
    return "The selected file is empty.";
  }
  return null;
}

export function formatFileSize(bytes: number) {
  if (bytes < 1_000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${(bytes / 1_000).toFixed(1)} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

export function rosterValue(values: Record<string, unknown>, key: string) {
  const value = values[key];
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

export function rosterStudentName(row: StudentRosterImportRow) {
  const fullName = rosterValue(row.normalizedValues, "full_name");
  if (fullName !== "—") return fullName;
  const firstName = rosterValue(row.normalizedValues, "first_name");
  const lastName = rosterValue(row.normalizedValues, "last_name");
  const combined = [firstName, lastName].filter((value) => value !== "—").join(" ");
  return combined || "Unnamed student";
}

export function rosterIssueCount(counts: StudentRosterImportCounts) {
  return counts.duplicate + counts.invalid + counts.skipped + counts.failed;
}

export function buildStudentRosterMappingAssignments(
  sourceColumns: StudentRosterSourceColumn[],
  mapping: Record<string, string | null>,
): StudentRosterMappingAssignment[] {
  return sourceColumns.map((column) => ({
    sourceColumn: column.original,
    canonicalField: mapping[column.normalized] ?? null,
  }));
}

export function beginStudentRosterConfirmation(guard: { current: boolean }) {
  if (guard.current) return false;
  guard.current = true;
  return true;
}

export function studentRosterStateLabel(state: StudentRosterImportState) {
  const labels: Record<StudentRosterImportState, string> = {
    uploaded: "Uploaded",
    parsing: "Processing",
    mapping_required: "Mapping required",
    ready_for_review: "Ready to import",
    importing: "Importing",
    completed: "Import complete",
    completed_with_errors: "Completed with issues",
    failed: "Import failed",
  };
  return labels[state];
}
