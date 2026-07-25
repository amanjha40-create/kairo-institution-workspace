import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SignupShell } from "@/components/institution/SignupShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useInstitutionAuth } from "@/lib/institution/auth";
import { institutionAppConfig } from "@/lib/institution/config";
import { getInstitutionErrorMessage } from "@/lib/institution/errors";
import {
  getInstitutionSignupDraft,
  submitInstitutionWorkspaceApplication,
  updateSignupAcknowledgements,
  type InstitutionSignupDraft,
  type VerificationMethod,
} from "@/lib/institution/signup";

export const Route = createFileRoute("/institution/signup/review")({
  head: () => ({
    meta: [
      { title: "Review your workspace request — Kairo" },
      {
        name: "description",
        content: "Review your Kairo institution workspace request before submission.",
      },
      { property: "og:title", content: "Review — Kairo" },
      { property: "og:description", content: "Review your institution workspace request." },
    ],
  }),
  component: ReviewStep,
});

const METHOD_LABEL: Record<VerificationMethod, string> = {
  email: "Official email verification",
  domain: "Domain verification",
  manual: "Manual review",
};

function ReviewStep() {
  const navigate = useNavigate();
  const { refreshSession } = useInstitutionAuth();
  const [draft, setDraft] = useState<InstitutionSignupDraft | null>(null);
  const [ack, setAck] = useState({ terms: false, privacy: false, authority: false });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const d = getInstitutionSignupDraft();
    if (!d) {
      navigate({ to: "/institution/signup/institution", replace: true });
      return;
    }
    setDraft(d);
    setAck({
      terms: d.acceptedTerms,
      privacy: d.acceptedPrivacy,
      authority: d.acceptedAuthority,
    });
  }, [navigate]);

  if (!draft) return null;

  const workspaceStatus =
    draft.verification.method === "email" && draft.verification.emailStatus === "verified"
      ? "Workspace created and pending institution verification"
      : draft.verification.method === "manual"
        ? "Verification Pending — manual review"
        : "Email Verification Required";

  const allAccepted = ack.terms && ack.privacy && ack.authority;

  const onSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      updateSignupAcknowledgements({
        acceptedTerms: ack.terms,
        acceptedPrivacy: ack.privacy,
        acceptedAuthority: ack.authority,
      });
      await submitInstitutionWorkspaceApplication();
      await refreshSession();
      navigate({ to: "/institution/signup/success" });
    } catch (err) {
      setError(getInstitutionErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SignupShell
      step="review"
      title="Review and submit"
      description="Confirm your details before creating the workspace request."
    >
      <div className="space-y-5">
        {!institutionAppConfig.demoMode && !institutionAppConfig.backendConfigured && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Institution signup is unavailable until the shared backend API base URL is configured
            for this workspace.
          </div>
        )}
        <SummarySection title="Institution">
          <Row label="Name" value={draft.institution.name || "—"} />
          <Row label="Type" value={draft.institution.type || "—"} />
          <Row label="Website" value={draft.institution.website || "—"} />
          <Row label="Domain" value={draft.institution.domain || "—"} />
          <Row
            label="Location"
            value={
              [draft.institution.city, draft.institution.country].filter(Boolean).join(", ") || "—"
            }
          />
          <Row label="Verification email" value={draft.institution.verificationEmail || "—"} />
        </SummarySection>

        <SummarySection title="Administrator">
          <Row label="Name" value={draft.administrator.fullName || "—"} />
          <Row label="Job title" value={draft.administrator.jobTitle || "—"} />
          <Row label="Work email" value={draft.administrator.workEmail || "—"} />
          {draft.administrator.phone && <Row label="Phone" value={draft.administrator.phone} />}
        </SummarySection>

        <SummarySection title="Verification">
          <Row label="Method" value={METHOD_LABEL[draft.verification.method]} />
          <Row label="Workspace status on submission" value={workspaceStatus} />
        </SummarySection>

        <div className="space-y-2 rounded-md border border-border bg-secondary/40 p-3">
          <Ack
            id="terms"
            checked={ack.terms}
            onChange={(v) => setAck((a) => ({ ...a, terms: v }))}
            label="I accept the Terms of Service."
          />
          <Ack
            id="privacy"
            checked={ack.privacy}
            onChange={(v) => setAck((a) => ({ ...a, privacy: v }))}
            label="I accept the Privacy Policy."
          />
          <Ack
            id="authority"
            checked={ack.authority}
            onChange={(v) => setAck((a) => ({ ...a, authority: v }))}
            label="I confirm that I am authorized to create this institution's workspace on Kairo."
          />
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800"
          >
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <Button asChild variant="ghost" type="button">
            <Link to="/institution/signup/verify">Edit Details</Link>
          </Button>
          <Button type="button" onClick={onSubmit} disabled={!allAccepted || submitting}>
            {submitting ? "Creating workspace…" : "Create Institution Workspace"}
          </Button>
        </div>
      </div>
    </SignupShell>
  );
}

function SummarySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-white">
      <div className="border-b border-border/70 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="divide-y divide-border/70">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
      <div className="text-muted-foreground">{label}</div>
      <div className="text-foreground">{value}</div>
    </div>
  );
}

function Ack({
  id,
  checked,
  onChange,
  label,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      <label htmlFor={id} className="text-xs text-foreground">
        {label}
      </label>
    </div>
  );
}
