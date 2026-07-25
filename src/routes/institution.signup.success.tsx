import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SignupShell } from "@/components/institution/SignupShell";
import { EmptyState } from "@/components/institution/PageStates";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Sparkles } from "lucide-react";
import { useInstitutionAuth } from "@/lib/institution/auth";
import { institutionAppConfig } from "@/lib/institution/config";
import {
  createMockApprovedInstitutionSession,
  getInstitutionWorkspaceApplication,
  statusLabel,
  type WorkspaceApplication,
} from "@/lib/institution/signup";

export const Route = createFileRoute("/institution/signup/success")({
  head: () => ({
    meta: [
      { title: "Workspace request submitted — Kairo" },
      {
        name: "description",
        content: "Your Kairo institution workspace request has been submitted for review.",
      },
      { property: "og:title", content: "Workspace request submitted — Kairo" },
      { property: "og:description", content: "We've received your institution workspace request." },
    ],
  }),
  component: SuccessPage,
});

function SuccessPage() {
  const navigate = useNavigate();
  const { session } = useInstitutionAuth();
  const [app, setApp] = useState<WorkspaceApplication | null>(null);

  useEffect(() => {
    setApp(getInstitutionWorkspaceApplication());
  }, []);

  if (!app) {
    return (
      <SignupShell step="review" title="No demo workspace request found">
        <EmptyState
          title="No signup request found"
          description="Complete the institution signup flow first to preview the success state."
          action={
            <Button asChild>
              <Link to="/institution/signup">Start signup</Link>
            </Button>
          }
        />
      </SignupShell>
    );
  }

  const institutionName = app?.institution.name || "your institution";

  const previewApproved = () => {
    if (!app) return;
    createMockApprovedInstitutionSession({
      name: app.administrator.fullName || "Institution Admin",
      email: app.administrator.workEmail || "admin@example.edu",
      institutionName: app.institution.name || "Your Institution",
    });
    navigate({ to: "/institution/verifications" });
  };

  return (
    <SignupShell step="review" title="Institution workspace request submitted">
      <div className="space-y-6">
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700" />
          <p className="text-sm text-emerald-900">
            Your workspace for <strong>{institutionName}</strong> has been created. Institution
            verification and approval continue separately while your team can now sign in and use
            the workspace context.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-white">
          <div className="border-b border-border/70 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Application status
          </div>
          <div className="divide-y divide-border/70">
            <Row label="Institution" value={institutionName} />
            <Row label="Status" value={app ? statusLabel(app.status) : "Verification Pending"} />
            <Row label="Administrator" value={app?.administrator.fullName || "—"} />
            <Row label="Email" value={app?.administrator.workEmail || "—"} />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button asChild variant="ghost">
            <Link to="/institution">Return to Kairo for Institutions</Link>
          </Button>
          {session ? (
            <Button asChild>
              <Link to="/institution/verifications">Open Workspace</Link>
            </Button>
          ) : (
            <Button asChild>
              <Link to="/institution/login">Go to sign in</Link>
            </Button>
          )}
        </div>

        {institutionAppConfig.demoMode && (
          <div className="rounded-xl border border-dashed border-[color:var(--kairo-navy-deep)]/30 bg-[color:var(--kairo-teal-soft)]/40 p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-4 w-4 text-[color:var(--kairo-navy-deep)]" />
              <div className="flex-1">
                <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--kairo-navy-deep)]">
                  Demo Mode only
                </div>
                <p className="mt-1 text-xs text-[color:var(--kairo-navy-deep)]/80">
                  Simulate an approved workspace to preview the reviewer experience. This action is
                  hidden whenever Demo Mode is disabled.
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="mt-3"
                  onClick={previewApproved}
                  disabled={!app}
                >
                  Preview approved workspace
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SignupShell>
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
