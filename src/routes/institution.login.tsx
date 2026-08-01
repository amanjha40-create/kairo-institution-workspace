import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { KairoLogo } from "@/components/institution/Logo";
import { useInstitutionAuth } from "@/lib/institution/auth";
import { institutionAppConfig, institutionDemoModeEnabled } from "@/lib/institution/config";
import { getInstitutionErrorMessage } from "@/lib/institution/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const searchSchema = z.object({
  redirect: z.string().optional(),
  reset_token: z.string().optional(),
  token: z.string().optional(),
});

export const Route = createFileRoute("/institution/login")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in — Institution Trust Workspace" },
      {
        name: "description",
        content: "Secure sign in for institutions using Kairo's Trust Workspace.",
      },
      { property: "og:title", content: "Sign in — Institution Trust Workspace" },
      {
        property: "og:description",
        content: "Secure sign in for institutions using Kairo's Trust Workspace.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { signIn, requestPasswordReset, completePasswordReset, isDemoMode } = useInstitutionAuth();
  const search = useSearch({ from: "/institution/login" });
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resetToken = search.reset_token ?? search.token;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const nextSession = await signIn(email, password);
      navigate({
        to: nextSession
          ? (search.redirect ?? "/institution/verifications")
          : "/institution/signup/institution",
        replace: true,
      });
    } catch (err) {
      setError(getInstitutionErrorMessage(err, "We couldn't sign you in."));
    } finally {
      setLoading(false);
    }
  };

  const onResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetToken) return;
    if (!newPassword || !confirmPassword) {
      setError("Enter and confirm your new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await completePasswordReset(resetToken, newPassword);
      toast.success("Password updated. You can now sign in.");
      navigate({ to: "/institution/login", replace: true });
    } catch (err) {
      setError(getInstitutionErrorMessage(err, "We couldn't complete that password reset."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-white to-[color:var(--kairo-teal-soft)]">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
        <div className="mb-8 flex flex-col items-center gap-2">
          <KairoLogo className="h-10 w-auto" />
          <span className="mt-1 rounded-full bg-[color:var(--kairo-teal-soft)] px-3 py-0.5 text-xs font-semibold uppercase tracking-wide text-[color:var(--kairo-navy-deep)]">
            Institution Trust Workspace
          </span>
        </div>
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-foreground">
            {resetToken ? "Reset password" : "Sign in"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {resetToken
              ? "Choose a new password to finish resetting your Institution Workspace account."
              : "Verify education claims and protect your institution's trust."}
          </p>
          <form onSubmit={resetToken ? onResetSubmit : onSubmit} className="mt-5 space-y-4">
            {resetToken ? (
              <>
                <div>
                  <Label htmlFor="new-password">New password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="confirm-password">Confirm new password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label htmlFor="email">Work email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <button
                      type="button"
                      className="text-xs text-[color:var(--kairo-navy)] underline-offset-2 hover:underline"
                      onClick={async () => {
                        if (!email.trim()) {
                          setError("Enter your work email first to request a password reset.");
                          return;
                        }

                        try {
                          await requestPasswordReset(email.trim());
                          toast.success(
                            isDemoMode
                              ? "Demo password reset request accepted."
                              : "If an account exists for that email, a password reset email has been sent.",
                          );
                        } catch (err) {
                          setError(getInstitutionErrorMessage(err));
                        }
                      }}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </>
            )}
            {error && (
              <div
                role="alert"
                className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800"
              >
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? resetToken
                  ? "Updating…"
                  : "Signing in…"
                : resetToken
                  ? "Update password"
                  : "Sign in"}
            </Button>
          </form>
          {institutionDemoModeEnabled && isDemoMode && (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Demo Mode is enabled. Use a Northbridge University team email and the demo password to
              preview the workspace.
            </div>
          )}
          {!institutionAppConfig.demoMode && !institutionAppConfig.backendConfigured && (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Institution sign-in is not live yet. Production mode stays closed until the approved
              institution authentication API is connected.
            </div>
          )}
          <div className="mt-5 flex items-start gap-2 rounded-md border border-border bg-secondary/50 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 text-[color:var(--kairo-navy)]" />
            <span>
              This workspace is restricted to authorized institution staff. Sessions are audited and
              end automatically after inactivity.
            </span>
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Responding to a one-off request? Use the unique secure verification link sent to your
          institution.
        </p>
        {institutionDemoModeEnabled && isDemoMode && (
          <p className="mt-2 text-center text-xs text-amber-900">
            Demo preview:{" "}
            <Link
              to="/institution/verify/$token"
              params={{ token: "valid-token" }}
              className="underline underline-offset-2"
            >
              open the sample magic-link request
            </Link>
            .
          </p>
        )}
        <div className="mt-3 flex flex-col items-center gap-1 text-center text-xs">
          <span className="text-muted-foreground">
            New to Kairo?{" "}
            <Link
              to="/institution/signup"
              className="font-medium text-[color:var(--kairo-navy)] underline-offset-2 hover:underline"
            >
              Create an Institution Workspace
            </Link>
          </span>
          <Link
            to="/institution"
            className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Learn how Kairo helps institutions
          </Link>
        </div>
      </div>
    </div>
  );
}
