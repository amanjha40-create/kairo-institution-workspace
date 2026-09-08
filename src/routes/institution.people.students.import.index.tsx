import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Download, FileSpreadsheet, History, Upload } from "lucide-react";
import { uploadInstitutionStudentRosterFile } from "@/lib/institution/api";
import { useInstitutionAuth } from "@/lib/institution/auth";
import { getInstitutionErrorMessage } from "@/lib/institution/errors";
import { getInstitutionPermissions } from "@/lib/institution/permissions";
import {
  formatFileSize,
  STUDENT_ROSTER_TEMPLATE_PATH,
  validateStudentRosterFile,
} from "@/lib/institution/roster";
import {
  PermissionDeniedState,
  ServiceUnavailableState,
} from "@/components/institution/PageStates";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/institution/people/students/import/")({
  component: StudentRosterImportPage,
});

function StudentRosterImportPage() {
  const navigate = useNavigate();
  const { session, isDemoMode } = useInstitutionAuth();
  const permissions = getInstitutionPermissions(session);
  const organizationId = session?.institutionId;
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const uploadMutation = useMutation({
    mutationFn: async (selectedFile: File) => {
      if (!organizationId) throw new Error("An active institution context is required.");
      return uploadInstitutionStudentRosterFile(organizationId, selectedFile);
    },
    onSuccess: (result) => {
      navigate({
        to: "/institution/people/students/import/$importId",
        params: { importId: result.id },
      });
    },
  });

  if (!permissions.canImportStudentRoster) return <PermissionDeniedState />;
  if (isDemoMode) {
    return (
      <ServiceUnavailableState
        title="Student import is unavailable in Demo Mode"
        description="Connect to an institution backend to upload a student roster."
      />
    );
  }

  const chooseFile = (selected: File | null) => {
    uploadMutation.reset();
    if (!selected) {
      setFile(null);
      setFileError(null);
      return;
    }
    const validationMessage = validateStudentRosterFile(selected);
    setFile(validationMessage ? null : selected);
    setFileError(validationMessage);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button variant="link" className="h-auto p-0 text-muted-foreground" asChild>
            <Link to="/institution/people/students">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to student roster
            </Link>
          </Button>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Import Students</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Add or update organization-provided student records.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/institution/people/students/import/history">
            <History className="h-4 w-4" aria-hidden="true" /> Import history
          </Link>
        </Button>
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <div className="border-b border-border bg-[color:var(--kairo-navy)] px-6 py-5 text-white">
          <h2 className="text-xl font-semibold">Import your student roster</h2>
          <p className="mt-1 text-sm text-white/75">
            Upload a CSV or Excel file to add or update students in your institution database.
          </p>
        </div>
        <div className="space-y-6 p-6">
          <div
            className="rounded-xl border-2 border-dashed border-cyan-200 bg-cyan-50/50 p-8 text-center transition-colors focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-200"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              chooseFile(event.dataTransfer.files[0] ?? null);
            }}
          >
            <FileSpreadsheet className="mx-auto h-10 w-10 text-cyan-700" aria-hidden="true" />
            <Label htmlFor="student-roster-file" className="mt-4 block text-base font-semibold">
              Choose a CSV or XLSX file
            </Label>
            <p className="mt-1 text-sm text-muted-foreground">or drag and drop it here</p>
            <input
              id="student-roster-file"
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="mx-auto mt-4 block max-w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-[color:var(--kairo-navy)] file:px-4 file:py-2 file:font-medium file:text-white hover:file:opacity-90"
              onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
              disabled={uploadMutation.isPending}
            />
            <p className="mt-3 text-xs text-muted-foreground">
              Maximum 5 MB, 10,000 rows, 64 columns, and a 255-character filename. The backend
              performs the final validation.
            </p>
          </div>

          {file && (
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-secondary/30 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{file.name}</div>
                <div className="text-xs text-muted-foreground">
                  {file.name.split(".").pop()?.toUpperCase()} · {formatFileSize(file.size)}
                </div>
              </div>
              <span className="text-xs font-medium text-cyan-800">Ready to upload</span>
            </div>
          )}

          {(fileError || uploadMutation.isError) && (
            <div
              role="alert"
              aria-live="assertive"
              className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
            >
              {fileError || getInstitutionErrorMessage(uploadMutation.error)}
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="outline" asChild>
              <a href={STUDENT_ROSTER_TEMPLATE_PATH} download>
                <Download className="h-4 w-4" aria-hidden="true" /> Download template
              </a>
            </Button>
            <Button
              onClick={() => file && uploadMutation.mutate(file)}
              disabled={!file || uploadMutation.isPending}
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              {uploadMutation.isPending ? "Uploading…" : "Upload file"}
            </Button>
          </div>
        </div>
      </section>

      <aside className="rounded-lg border border-border bg-white p-5">
        <h2 className="font-semibold">Before you upload</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Include a usable name for every student.</li>
          <li>Include Student ID, Roll Number, or Institution Email for identity matching.</li>
          <li>Review the mapping and preview before confirming the import.</li>
          <li>Imported records are organization-provided and are not Kairo verified.</li>
        </ul>
      </aside>
    </div>
  );
}
