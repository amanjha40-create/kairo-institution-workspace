import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/institution/people/students")({
  component: StudentRosterLayout,
});

function StudentRosterLayout() {
  return <Outlet />;
}
