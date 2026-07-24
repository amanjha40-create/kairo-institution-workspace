import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import {
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  ClipboardCheck,
  Users,
  FileSearch,
  Building2,
  Lock,
  X,
} from "lucide-react";
import { PublicHeader } from "@/components/institution/PublicHeader";
import { useInstitutionAuth } from "@/lib/institution/auth";

const searchSchema = z.object({
  source: z.string().optional(),
});

export const Route = createFileRoute("/institution/")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Kairo for Institutions — Protect the trust behind every credential" },
      {
        name: "description",
        content:
          "Kairo helps institutions respond to education verification requests, confirm credentials faster, and protect their name from inaccurate or unverified claims.",
      },
      { property: "og:title", content: "Kairo for Institutions" },
      {
        property: "og:description",
        content:
          "Respond to education verification requests, confirm credentials faster, and protect your institution's name.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PublicInstitutionPage,
});

function PublicInstitutionPage() {
  const { session, hydrated } = useInstitutionAuth();
  const search = Route.useSearch();
  const authed = hydrated && !!session;
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (search.source === "verification-complete" && !authed) setShowBanner(true);
  }, [search.source, authed]);

  return (
    <div className="min-h-screen bg-white text-foreground">
      <PublicHeader />

      {showBanner && (
        <div className="border-b border-[color:var(--kairo-teal-soft)] bg-[color:var(--kairo-teal-soft)]/40">
          <div className="mx-auto flex max-w-6xl items-start gap-3 px-4 py-3 sm:px-6">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--kairo-navy-deep)]" />
            <p className="flex-1 text-sm text-[color:var(--kairo-navy-deep)]">
              Your verification response is complete. Create an Institution Workspace to manage
              future requests, connected records, and your institution's verification history in one
              place.
            </p>
            <Link
              to="/institution/signup"
              className="hidden rounded-md bg-[color:var(--kairo-navy-deep)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-95 sm:inline-flex"
            >
              Create Institution Workspace
            </Link>
            <button
              type="button"
              aria-label="Dismiss"
              className="rounded p-1 text-[color:var(--kairo-navy-deep)]/70 hover:bg-white/60"
              onClick={() => setShowBanner(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-gradient-to-b from-[color:var(--kairo-teal-soft)]/60 to-transparent" />
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--kairo-teal-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--kairo-navy-deep)]">
              <ShieldCheck className="h-3.5 w-3.5" /> Institution Trust Workspace
            </span>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Protect the trust behind every credential you issue.
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
              Kairo helps institutions respond to education verification requests, confirm
              credentials faster, and protect their name from inaccurate or unverified claims.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              {authed ? (
                <Link
                  to="/institution/verifications"
                  className="inline-flex items-center gap-2 rounded-md bg-[color:var(--kairo-navy-deep)] px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-95"
                >
                  Open Workspace <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <Link
                  to="/institution/signup"
                  className="inline-flex items-center gap-2 rounded-md bg-[color:var(--kairo-navy-deep)] px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-95"
                >
                  Create Institution Workspace <ArrowRight className="h-4 w-4" />
                </Link>
              )}
              <Link
                to="/institution/login"
                className="inline-flex items-center rounded-md border border-border bg-white px-5 py-2.5 text-sm font-medium text-foreground hover:bg-secondary"
              >
                Sign in
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Responding to a one-time request? Use your secure verification link.
            </p>
          </div>
        </div>
      </section>

      {/* Value */}
      <section className="border-t border-border/60 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Your institution should remain the source of truth.
            </h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            <ValueCard
              Icon={FileSearch}
              title="Verify without unnecessary searching"
              body="When records are connected, reviewers can see the candidate's claim and the matching institution record together, then confirm or report a discrepancy."
            />
            <ValueCard
              Icon={ShieldCheck}
              title="Protect your institution's name"
              body="Distinguish institution-verified credentials from pending, incorrect, disputed, or revoked claims made through Kairo."
            />
            <ValueCard
              Icon={ClipboardCheck}
              title="Maintain trusted lifelong records"
              body="Issue and manage trusted education credentials while viewing consented professional updates from connected students and alumni."
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        className="border-t border-border/60 bg-[color:var(--kairo-teal-soft)]/25"
      >
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              How Kairo works for institutions
            </h2>
          </div>
          <ol className="mt-10 grid gap-4 md:grid-cols-4">
            <Step
              n={1}
              title="Receive a request"
              body="A candidate or organization sends an education verification request."
            />
            <Step
              n={2}
              title="Review the information"
              body="Compare the candidate-submitted claim with the institution record and shared evidence."
            />
            <Step
              n={3}
              title="Respond with authority"
              body="Confirm the claim, report a discrepancy, or request clarification."
            />
            <Step
              n={4}
              title="Build persistent trust"
              body="The verified education credential remains connected to the individual's Kairo Trust Passport."
            />
          </ol>
        </div>
      </section>

      {/* Partner vs one-time */}
      <section className="border-t border-border/60 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Use Kairo once, or manage every request in one place.
            </h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
              <h3 className="text-base font-semibold text-foreground">One-time verification</h3>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <BulletItem>No account required</BulletItem>
                <BulletItem>Secure magic link</BulletItem>
                <BulletItem>Respond to one request</BulletItem>
                <BulletItem>Confirm, report discrepancy, or request clarification</BulletItem>
              </ul>
              <div className="mt-6 rounded-md border border-dashed border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
                Use the secure link sent with your request.
              </div>
            </div>
            <div className="rounded-2xl border-2 border-[color:var(--kairo-navy-deep)]/20 bg-white p-6 shadow-sm">
              <h3 className="text-base font-semibold text-foreground">Institution Workspace</h3>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <BulletItem>Central verification inbox</BulletItem>
                <BulletItem>Connected institution records</BulletItem>
                <BulletItem>People and credential visibility</BulletItem>
                <BulletItem>Team access and permissions</BulletItem>
                <BulletItem>Verification history</BulletItem>
                <BulletItem>Consent-controlled professional information</BulletItem>
              </ul>
              <div className="mt-6">
                {authed ? (
                  <Link
                    to="/institution/verifications"
                    className="inline-flex items-center gap-2 rounded-md bg-[color:var(--kairo-navy-deep)] px-4 py-2 text-sm font-medium text-white hover:opacity-95"
                  >
                    Open Workspace <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <Link
                    to="/institution/signup"
                    className="inline-flex items-center gap-2 rounded-md bg-[color:var(--kairo-navy-deep)] px-4 py-2 text-sm font-medium text-white hover:opacity-95"
                  >
                    Create Institution Workspace <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust and control */}
      <section className="border-t border-border/60 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid gap-8 md:grid-cols-[1fr_1.4fr]">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                The institution stays in control.
              </h2>
              <p className="mt-3 text-sm text-muted-foreground">
                Kairo is built so authority stays where it belongs — with the institution that
                issued the credential.
              </p>
            </div>
            <ul className="space-y-3">
              <TrustItem>Kairo does not make the final verification decision.</TrustItem>
              <TrustItem>The institution confirms or corrects its own records.</TrustItem>
              <TrustItem>
                Professional information is shown only when the individual has consented to share
                it.
              </TrustItem>
              <TrustItem>
                Institution staff cannot edit employment, external licences, or external
                qualifications.
              </TrustItem>
              <TrustItem>
                All verification responses and credential changes maintain an audit trail.
              </TrustItem>
            </ul>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-border/60 bg-gradient-to-br from-white to-[color:var(--kairo-teal-soft)]/50">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Make every credential easier to trust.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
            Create a secure workspace for your institution and manage education verification
            requests from one place.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {authed ? (
              <Link
                to="/institution/verifications"
                className="inline-flex items-center gap-2 rounded-md bg-[color:var(--kairo-navy-deep)] px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-95"
              >
                Open Workspace
              </Link>
            ) : (
              <Link
                to="/institution/signup"
                className="inline-flex items-center gap-2 rounded-md bg-[color:var(--kairo-navy-deep)] px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-95"
              >
                Create Institution Workspace
              </Link>
            )}
            <Link
              to="/institution/login"
              className="inline-flex items-center rounded-md border border-border bg-white px-5 py-2.5 text-sm font-medium text-foreground hover:bg-secondary"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60 bg-white py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <div>© {new Date().getFullYear()} Kairo. All rights reserved.</div>
          <div className="flex items-center gap-4">
            <Link to="/institution/login" className="hover:text-foreground">
              Sign in
            </Link>
            <Link to="/institution/signup" className="hover:text-foreground">
              Create Workspace
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ValueCard({
  Icon,
  title,
  body,
}: {
  Icon: typeof ShieldCheck;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-[color:var(--kairo-teal-soft)] text-[color:var(--kairo-navy-deep)]">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="rounded-2xl border border-border bg-white p-5 shadow-sm">
      <div className="grid h-8 w-8 place-items-center rounded-full bg-[color:var(--kairo-navy-deep)] text-sm font-semibold text-white">
        {n}
      </div>
      <h3 className="mt-4 text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
    </li>
  );
}

function BulletItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--kairo-navy)]" />
      <span>{children}</span>
    </li>
  );
}

function TrustItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 rounded-lg border border-border bg-white p-3">
      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--kairo-navy-deep)]" />
      <span className="text-sm text-foreground">{children}</span>
    </li>
  );
}

// Kept to satisfy unused-import fear; referenced only in the file. Remove if unused.
// (Building2, Users are exported from lucide-react; keep for potential expansion.)
void Building2;
void Users;
