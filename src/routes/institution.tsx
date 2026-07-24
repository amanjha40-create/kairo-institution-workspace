import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { InstitutionAuthProvider, useInstitutionAuth } from "@/lib/institution/auth";
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
  const { session, hydrated } = useInstitutionAuth();

  const path = location.pathname;
  const isPublic =
    path === "/institution" ||
    path === "/institution/" ||
    path === "/institution/login" ||
    path.startsWith("/institution/signup") ||
    path.startsWith("/institution/verify/");

  useEffect(() => {
    if (!hydrated) return;
    if (isPublic) return;
    if (!session) {
      navigate({
        to: "/institution/login",
        search: { redirect: path },
        replace: true,
      });
    }
  }, [hydrated, session, isPublic, path, navigate]);

  if (isPublic) return <Outlet />;
  if (!hydrated || !session) {
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
