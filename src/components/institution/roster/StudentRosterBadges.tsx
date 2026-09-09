import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { studentRosterStateLabel } from "@/lib/institution/roster";
import type {
  StudentRosterImportState,
  StudentRosterRowApplicationStatus,
  StudentRosterRowDisposition,
} from "@/lib/institution/types";

const stateStyles: Record<StudentRosterImportState, string> = {
  uploaded: "border-slate-200 bg-slate-50 text-slate-700",
  parsing: "border-sky-200 bg-sky-50 text-sky-800",
  mapping_required: "border-amber-200 bg-amber-50 text-amber-800",
  ready_for_review: "border-cyan-200 bg-cyan-50 text-cyan-800",
  importing: "border-sky-200 bg-sky-50 text-sky-800",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-800",
  completed_with_errors: "border-amber-200 bg-amber-50 text-amber-800",
  failed: "border-rose-200 bg-rose-50 text-rose-800",
};

export function StudentRosterImportStateBadge({ state }: { state: StudentRosterImportState }) {
  return (
    <Badge variant="outline" className={cn("font-medium", stateStyles[state])}>
      {studentRosterStateLabel(state)}
    </Badge>
  );
}

const dispositionLabels: Record<StudentRosterRowDisposition, string> = {
  valid_new: "New",
  valid_update: "Update",
  duplicate: "Duplicate",
  invalid: "Invalid",
  skipped: "Skipped",
};

const dispositionStyles: Record<StudentRosterRowDisposition, string> = {
  valid_new: "border-emerald-200 bg-emerald-50 text-emerald-800",
  valid_update: "border-cyan-200 bg-cyan-50 text-cyan-800",
  duplicate: "border-amber-200 bg-amber-50 text-amber-800",
  invalid: "border-rose-200 bg-rose-50 text-rose-800",
  skipped: "border-slate-200 bg-slate-50 text-slate-700",
};

export function StudentRosterDispositionBadge({
  disposition,
}: {
  disposition: StudentRosterRowDisposition;
}) {
  return (
    <Badge variant="outline" className={cn("font-medium", dispositionStyles[disposition])}>
      {dispositionLabels[disposition]}
    </Badge>
  );
}

const applicationLabels: Record<StudentRosterRowApplicationStatus, string> = {
  pending: "Pending",
  ignored: "Not imported",
  created: "Added",
  updated: "Updated",
  failed: "Needs attention",
};

export function StudentRosterApplicationBadge({
  status,
}: {
  status: StudentRosterRowApplicationStatus;
}) {
  return (
    <Badge variant="secondary" className="font-medium">
      {applicationLabels[status]}
    </Badge>
  );
}

export function OrganizationProvidedBadge() {
  return (
    <Badge variant="outline" className="border-cyan-200 bg-cyan-50 text-cyan-800">
      Organization-provided
    </Badge>
  );
}
