import { Link } from "@tanstack/react-router";
import { KairoLogo } from "./Logo";
import { useInstitutionAuth } from "@/lib/institution/auth";
import { getInstitutionModeLabel, institutionAppConfig } from "@/lib/institution/config";

export function PublicHeader() {
  const { session, hydrated } = useInstitutionAuth();
  const authed = hydrated && !!session;

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link to="/institution" className="flex shrink-0 items-center gap-2">
          <KairoLogo className="h-7 w-auto" />
        </Link>
        <nav className="ml-2 hidden items-center gap-5 text-sm text-muted-foreground md:flex">
          <a href="#how-it-works" className="hover:text-foreground">
            How it works
          </a>
          <Link to="/institution" className="hover:text-foreground">
            For Institutions
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {institutionAppConfig.demoMode && (
            <span className="hidden rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-900 sm:inline-flex">
              {getInstitutionModeLabel()}
            </span>
          )}
          {authed ? (
            <Link
              to="/institution/verifications"
              className="inline-flex items-center rounded-md bg-[color:var(--kairo-navy-deep)] px-3.5 py-1.5 text-sm font-medium text-white hover:opacity-95"
            >
              Open Workspace
            </Link>
          ) : (
            <>
              <Link
                to="/institution/login"
                className="hidden rounded-md px-3 py-1.5 text-sm font-medium text-foreground hover:bg-secondary sm:inline-flex"
              >
                Sign in
              </Link>
              <Link
                to="/institution/signup"
                className="inline-flex items-center rounded-md bg-[color:var(--kairo-navy-deep)] px-3.5 py-1.5 text-sm font-medium text-white hover:opacity-95"
              >
                Create Workspace
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
