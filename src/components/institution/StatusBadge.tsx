import { cn } from "@/lib/utils";
import type {
  InstitutionStatus,
  PassportStatus,
  TrustStatus,
  VerificationStatus,
} from "@/lib/institution/types";

const verificationLabels: Record<VerificationStatus, string> = {
  pending: "Pending Review",
  in_progress: "In Progress",
  awaiting_clarification: "Awaiting Clarification",
  confirmed: "Confirmed",
  discrepancy: "Discrepancy Reported",
  closed: "Closed",
};

const verificationTones: Record<VerificationStatus, string> = {
  pending: "bg-amber-50 text-amber-800 ring-amber-200",
  in_progress: "bg-sky-50 text-sky-800 ring-sky-200",
  awaiting_clarification: "bg-violet-50 text-violet-800 ring-violet-200",
  confirmed: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  discrepancy: "bg-rose-50 text-rose-800 ring-rose-200",
  closed: "bg-slate-100 text-slate-700 ring-slate-200",
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

const trustLabels: Record<TrustStatus, string> = {
  institution_verified: "Institution Verified",
  pending: "Pending Verification",
  disputed: "Disputed",
  revoked: "Revoked",
};

const trustTones: Record<TrustStatus, string> = {
  institution_verified: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  pending: "bg-amber-50 text-amber-800 ring-amber-200",
  disputed: "bg-rose-50 text-rose-800 ring-rose-200",
  revoked: "bg-slate-100 text-slate-700 ring-slate-200",
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
