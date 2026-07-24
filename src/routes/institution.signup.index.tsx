import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/institution/signup/")({
  component: () => <Navigate to="/institution/signup/institution" replace />,
});
