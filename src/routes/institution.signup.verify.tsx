import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SignupShell } from "@/components/institution/SignupShell";
import { institutionAppConfig, institutionDemoModeEnabled } from "@/lib/institution/config";
import { getInstitutionErrorMessage } from "@/lib/institution/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Globe, Mail, ShieldAlert, ShieldCheck } from "lucide-react";
import {
  extractDomain,
  getInstitutionSignupDraft,
  recoverInstitutionEmailVerificationSession,
  requestInstitutionEmailVerification,
  updateInstitutionVerification,
  verifyInstitutionEmailCode,
  type EmailVerificationStatus,
  type VerificationMethod,
} from "@/lib/institution/signup";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/institution/signup/verify")({
  head: () => ({
    meta: [
      { title: "Verify your institution — Kairo" },
      {
        name: "description",
        content:
          "Verify your institution to activate authority to issue or revoke credentials on Kairo.",
      },
      { property: "og:title", content: "Verify your institution — Kairo" },
      { property: "og:description", content: "Choose a verification method for your institution." },
    ],
  }),
  component: VerifyStep,
});

function VerifyStep() {
  const navigate = useNavigate();
  const [method, setMethod] = useState<VerificationMethod>("email");
  const [emailStatus, setEmailStatus] = useState<EmailVerificationStatus>("not_started");
  const [institutionDomain, setInstitutionDomain] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const syncDraftState = () => {
      const draft = getInstitutionSignupDraft();
      if (!draft) {
        navigate({ to: "/institution/signup/institution", replace: true });
        return false;
      }
      setMethod(draft.verification.method);
      setEmailStatus(draft.verification.emailStatus);
      setInstitutionDomain(draft.institution.domain);
      setAdminEmail(draft.administrator.workEmail);
      setNote(draft.verification.manualNote ?? "");
      return true;
    };

    if (!syncDraftState()) {
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const recovery = await recoverInstitutionEmailVerificationSession();
        if (!cancelled && recovery.recovered) {
          syncDraftState();
          setNotice(recovery.message ?? null);
        }
      } catch (err) {
        if (!cancelled) {
          syncDraftState();
          setError(getInstitutionErrorMessage(err));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const domainMatch =
    !!institutionDomain &&
    !!adminEmail &&
    extractDomain(adminEmail) === institutionDomain.trim().toLowerCase();

  const chooseMethod = (m: VerificationMethod) => {
    if (!institutionDemoModeEnabled && m !== "email") return;
    setMethod(m);
    updateInstitutionVerification({ method: m });
  };

  const sendCode = async () => {
    setError(null);
    setNotice(null);
    setSending(true);
    try {
      const result = await requestInstitutionEmailVerification();
      setEmailStatus("code_sent");
      setNotice(result.message ?? null);
    } catch (err) {
      setError(getInstitutionErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const submitCode = async () => {
    setError(null);
    setVerifying(true);
    try {
      const { status } = await verifyInstitutionEmailCode(code);
      setEmailStatus(status);
    } catch (err) {
      setError(getInstitutionErrorMessage(err));
    } finally {
      setVerifying(false);
    }
  };

  const canContinue =
    (method === "email" && emailStatus === "verified") ||
    method === "domain" ||
    method === "manual";

  const onContinue = () => {
    updateInstitutionVerification({ method, emailStatus, manualNote: note });
    navigate({ to: "/institution/signup/review" });
  };

  return (
    <SignupShell
      step="verify"
      title="Verify your institution"
      description="Verify the administrator work email to create the institution workspace. Institution approval and advanced verification controls continue separately after onboarding."
    >
      {!institutionAppConfig.demoMode && !institutionAppConfig.backendConfigured && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Institution signup is unavailable until the shared backend API base URL is configured for
          this workspace.
        </div>
      )}
      <div className="space-y-3">
        <MethodCard
          selected={method === "email"}
          onSelect={() => chooseMethod("email")}
          Icon={Mail}
          title="Official email verification"
          body="Send a verification code to the primary administrator's work email."
        >
          {method === "email" && (
            <div className="mt-4 space-y-3">
              <div>
                <Label>Administrator work email</Label>
                <Input value={adminEmail} disabled className="mt-1" />
                <p className="mt-1 text-xs text-muted-foreground">
                  We'll send a 6-digit code to this address to finish creating the account.
                </p>
              </div>
              {emailStatus === "not_started" && (
                <Button type="button" onClick={sendCode} disabled={sending || !adminEmail}>
                  {sending ? "Sending…" : "Send verification code"}
                </Button>
              )}
              {(emailStatus === "code_sent" || emailStatus === "failed") && (
                <div className="space-y-2">
                  <div className="rounded-md border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
                    Verification email sent. Enter the 6-digit code from your email to continue.
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      inputMode="numeric"
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="123456"
                      className="max-w-[160px]"
                    />
                    <Button
                      type="button"
                      onClick={submitCode}
                      disabled={verifying || code.length !== 6}
                    >
                      {verifying ? "Verifying…" : "Verify code"}
                    </Button>
                    <Button type="button" variant="ghost" onClick={sendCode} disabled={sending}>
                      Resend
                    </Button>
                  </div>
                  {emailStatus === "failed" && (
                    <p className="text-xs text-rose-700">
                      That code didn't work. Try again with a 6-digit code.
                    </p>
                  )}
                </div>
              )}
              {emailStatus === "verified" && (
                <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                  <CheckCircle2 className="h-4 w-4" /> Email verified.
                </div>
              )}
            </div>
          )}
        </MethodCard>

        <MethodCard
          selected={method === "domain"}
          onSelect={() => chooseMethod("domain")}
          Icon={Globe}
          title="Domain verification"
          body="Verify ownership of your official domain later from workspace settings."
          disabled={!institutionDemoModeEnabled}
        >
          {method === "domain" && (
            <div className="mt-4 space-y-2">
              <div className="rounded-md border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
                Institution domain: <span className="font-mono">{institutionDomain || "—"}</span>
              </div>
              <div
                className={cn(
                  "flex items-center gap-2 rounded-md border px-3 py-2 text-xs",
                  domainMatch
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : "border-amber-200 bg-amber-50 text-amber-900",
                )}
              >
                {domainMatch ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" /> Domain match detected between your work
                    email and the institution domain.
                  </>
                ) : (
                  <>
                    <ShieldAlert className="h-4 w-4" /> Domain match not detected. Verification will
                    remain pending until DNS ownership is confirmed after signup.
                  </>
                )}
              </div>
              {!institutionDemoModeEnabled && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Domain verification is part of a later institution-specific milestone and is not
                  active in this release.
                </div>
              )}
            </div>
          )}
        </MethodCard>

        <MethodCard
          selected={method === "manual"}
          onSelect={() => chooseMethod("manual")}
          Icon={ShieldCheck}
          title="Manual review"
          body="Submit your request for Kairo review. Useful when no institutional email is available."
          disabled={!institutionDemoModeEnabled}
        >
          {method === "manual" && (
            <div className="mt-4 space-y-2">
              <Label>Notes for the review team (optional)</Label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                rows={3}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="Share any context that will help our team confirm your institution."
              />
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Manual review can take longer. Your workspace will remain in Verification Pending
                until approved.
              </div>
            </div>
          )}
        </MethodCard>
      </div>
      {notice && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          {notice}
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800"
        >
          {error}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="ghost" type="button">
          <Link to="/institution/signup/admin">Back</Link>
        </Button>
        <Button type="button" onClick={onContinue} disabled={!canContinue}>
          Continue
        </Button>
      </div>
    </SignupShell>
  );
}

function MethodCard({
  selected,
  onSelect,
  Icon,
  title,
  body,
  children,
  disabled = false,
}: {
  selected: boolean;
  onSelect: () => void;
  Icon: typeof Mail;
  title: string;
  body: string;
  children?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-white p-4 transition-colors",
        selected
          ? "border-[color:var(--kairo-navy-deep)] ring-1 ring-[color:var(--kairo-navy-deep)]/20"
          : "border-border hover:border-[color:var(--kairo-navy-deep)]/40",
      )}
    >
      <button
        type="button"
        className="flex w-full items-start gap-3 text-left disabled:cursor-not-allowed"
        onClick={onSelect}
        disabled={disabled}
      >
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-[color:var(--kairo-teal-soft)] text-[color:var(--kairo-navy-deep)]">
          <Icon className="h-4 w-4" />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-semibold text-foreground">{title}</span>
          <span className="block text-xs text-muted-foreground">{body}</span>
        </span>
        <span
          className={cn(
            "mt-1 grid h-4 w-4 place-items-center rounded-full border",
            selected
              ? "border-[color:var(--kairo-navy-deep)] bg-[color:var(--kairo-navy-deep)]"
              : "border-border bg-white",
          )}
        >
          {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
        </span>
      </button>
      {children}
    </div>
  );
}
