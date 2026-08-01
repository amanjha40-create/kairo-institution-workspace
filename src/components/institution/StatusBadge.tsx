import { cn } from "@/lib/utils";
import type {
  InstitutionStatus,
  PassportStatus,
  TrustStatus,
  VerificationPriority,
  VerificationStatus,
} from "@/lib/institution/types";

const verificationLabels: Record<VerificationStatus, string> = {
  pending: "Pending Review",
  in_progress: "In Progress",
  awaiting_clarification: "Awaiting Clarification",
  confirmed: "Confirmed",
  discrepancy: "Discrepancy Reported",
  closed: "Closed",
  draft: "Draft",
  pending_subject_acceptance: "Waiting for Candidate",
  accepted: "Accepted",
  pending_subject_submission: "Waiting for Evidence",
  pending_admin_review: "Pending Admin Review",
  awaiting_subject_corrections: "Awaiting Candidate Corrections",
  pending_admin_re_review: "Pending Admin Re-review",
  approved_for_organization_verification: "Approved for Verification",
  pending_organization_resolution: "Pending Institution Resolution",
  pending_organization_acceptance: "Awaiting Institution Acceptance",
  awaiting_information: "Awaiting Information",
  verified: "Verified",
  rejected: "Rejected",
  cancelled: "Cancelled",
  expired: "Expired",
};

const verificationTones: Record<VerificationStatus, string> = {
  pending: "bg-amber-50 text-amber-800 ring-amber-200",
  in_progress: "bg-sky-50 text-sky-800 ring-sky-200",
  awaiting_clarification: "bg-violet-50 text-violet-800 ring-violet-200",
  confirmed: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  discrepancy: "bg-rose-50 text-rose-800 ring-rose-200",
  closed: "bg-slate-100 text-slate-700 ring-slate-200",
  draft: "bg-slate-100 text-slate-700 ring-slate-200",
  pending_subject_acceptance: "bg-amber-50 text-amber-800 ring-amber-200",
  accepted: "bg-amber-50 text-amber-800 ring-amber-200",
  pending_subject_submission: "bg-amber-50 text-amber-800 ring-amber-200",
  pending_admin_review: "bg-sky-50 text-sky-800 ring-sky-200",
  awaiting_subject_corrections: "bg-violet-50 text-violet-800 ring-violet-200",
  pending_admin_re_review: "bg-sky-50 text-sky-800 ring-sky-200",
  approved_for_organization_verification: "bg-sky-50 text-sky-800 ring-sky-200",
  pending_organization_resolution: "bg-sky-50 text-sky-800 ring-sky-200",
  pending_organization_acceptance: "bg-amber-50 text-amber-800 ring-amber-200",
  awaiting_information: "bg-violet-50 text-violet-800 ring-violet-200",
  verified: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  rejected: "bg-rose-50 text-rose-800 ring-rose-200",
  cancelled: "bg-slate-100 text-slate-700 ring-slate-200",
  expired: "bg-slate-100 text-slate-700 ring-slate-200",
};

export function VerificationStatusBadge({ status }: { status: VerificationStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        verificationTones[status],
      )}
    >
      {verificationLabels[status]}
    </span>
  );
}

const priorityLabels: Record<VerificationPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

const priorityTones: Record<VerificationPriority, string> = {
  low: "bg-slate-100 text-slate-700 ring-slate-200",
  normal: "bg-sky-50 text-sky-800 ring-sky-200",
  high: "bg-amber-50 text-amber-800 ring-amber-200",
  urgent: "bg-rose-50 text-rose-800 ring-rose-200",
};

export function VerificationPriorityBadge({ priority }: { priority: VerificationPriority }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        priorityTones[priority],
      )}
    >
      {priorityLabels[priority]}
    </span>
  );
}

const trustLabels: Record<TrustStatus, string> = {
  institution_verified: "Institution Verified",
  pending: "Pending Verification",
  disputed: "Disputed",
  revoked: "Revoked",
  not_started: "Not Started",
  verified: "Verified",
  discrepancy: "Discrepancy Found",
  clarification_required: "Clarification Required",
  rejected: "Rejected",
  expired: "Expired",
};

const trustTones: Record<TrustStatus, string> = {
  institution_verified: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  pending: "bg-amber-50 text-amber-800 ring-amber-200",
  disputed: "bg-rose-50 text-rose-800 ring-rose-200",
  revoked: "bg-slate-100 text-slate-700 ring-slate-200",
  not_started: "bg-slate-100 text-slate-700 ring-slate-200",
  verified: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  discrepancy: "bg-rose-50 text-rose-800 ring-rose-200",
  clarification_required: "bg-violet-50 text-violet-800 ring-violet-200",
  rejected: "bg-rose-50 text-rose-800 ring-rose-200",
  expired: "bg-slate-100 text-slate-700 ring-slate-200",
};

export function TrustStatusBadge({ status }: { status: TrustStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        trustTones[status],
      )}
    >
      {trustLabels[status]}
    </span>
  );
}

const instLabels: Record<InstitutionStatus, string> = {
  current_student: "Current Student",
  alumni: "Alumni",
  withdrawn: "Withdrawn",
  inactive: "Institution Record Inactive",
};

export function InstitutionStatusBadge({ status }: { status: InstitutionStatus }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200">
      {instLabels[status]}
    </span>
  );
}

const passportLabels: Record<PassportStatus, string> = {
  connected: "Passport Connected",
  not_connected: "Passport Not Connected",
  sharing_limited: "Sharing Limited",
};

export function PassportStatusBadge({ status }: { status: PassportStatus }) {
  const tone =
    status === "connected"
      ? "bg-[color:var(--kairo-teal-soft)] text-[color:var(--kairo-navy-deep)]"
      : "bg-slate-100 text-slate-700";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ring-transparent",
        tone,
      )}
    >
      {passportLabels[status]}
    </span>
  );
}
