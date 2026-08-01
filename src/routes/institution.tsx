import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { InstitutionAuthProvider, useInstitutionAuth } from "@/lib/institution/auth";
import { ServiceUnavailableState } from "@/components/institution/PageStates";
import { WorkspaceShell } from "@/components/institution/WorkspaceShell";

export const Route = createFileRoute("/institution")({
  head: () => ({
    meta: [
      { title: "Institution Trust Workspace — Kairo" },
      {
        name: "description",
        content:
          "A focused workspace for institutions to verify education claims and protect their trust and reputation.",
      },
      { property: "og:title", content: "Institution Trust Workspace — Kairo" },
      {
        property: "og:description",
        content:
          "Review verification requests, manage connected people, and protect your institution's trust.",
      },
    ],
  }),
  component: InstitutionLayout,
});

function InstitutionLayout() {
  return (
    <InstitutionAuthProvider>
      <InstitutionLayoutInner />
    </InstitutionAuthProvider>
  );
}

function InstitutionLayoutInner() {
  const location = useLocation();
  const navigate = useNavigate();
  const { session, hydrated, authenticated, bootstrap, error } = useInstitutionAuth();

  const path = location.pathname;
  const isInstitutionHome = path === "/institution" || path === "/institution/";
  const isAlwaysPublic =
    path === "/institution/login" ||
    path.startsWith("/institution/signup") ||
    path.startsWith("/institution/verify/");
  const shouldExposePublicHome = isInstitutionHome && hydrated && !authenticated;
  const isPublic = isAlwaysPublic || shouldExposePublicHome;

  useEffect(() => {
    if (!hydrated) return;
    if (isPublic) return;
    if (!authenticated) {
      navigate({
        to: "/institution/login",
        search: { redirect: path },
        replace: true,
      });
      return;
    }
    if (!session && bootstrap?.state === "no_org") {
      navigate({
        to: "/institution/signup/institution",
        replace: true,
      });
    }
  }, [authenticated, bootstrap?.state, hydrated, isPublic, navigate, path, session]);

  if (isAlwaysPublic || shouldExposePublicHome) return <Outlet />;
  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading workspace…
      </div>
    );
  }
  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <ServiceUnavailableState
          title="Institution workspace unavailable"
          description={error.uiMessage}
        />
      </div>
    );
  }
  if (!authenticated || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading workspace…
      </div>
    );
  }
  return (
    <WorkspaceShell>
      <Outlet />
    </WorkspaceShell>
  );
}
