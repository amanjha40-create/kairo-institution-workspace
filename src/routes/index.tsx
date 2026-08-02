import { createFileRoute, Link } from "@tanstack/react-router";
import { KairoLogo } from "@/components/institution/Logo";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kairo — Trust for institutions and the people they educate" },
      {
        name: "description",
        content:
          "Kairo helps universities, colleges and training institutes issue, verify and protect educational trust.",
      },
      {
        property: "og:title",
        content: "Kairo — Trust for institutions and the people they educate",
      },
      {
        property: "og:description",
        content:
          "Kairo helps universities, colleges and training institutes issue, verify and protect educational trust.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-white to-[color:var(--kairo-teal-soft)]">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 px-6 py-12 text-center">
        <KairoLogo className="h-10 w-auto" />
        <span className="rounded-full bg-[color:var(--kairo-teal-soft)] px-3 py-0.5 text-xs font-semibold uppercase tracking-wide text-[color:var(--kairo-navy-deep)]">
          Institution Trust Workspace
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Verify, protect, and stand behind the credentials you issue.
        </h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Kairo gives universities, colleges, schools, and training institutes a focused workspace
          to respond to education verification requests and protect the reputation of the people
          they educate.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/institution"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            <ShieldCheck className="h-4 w-4" /> Explore Kairo for Institutions
          </Link>
          <div className="rounded-md border border-border bg-white px-4 py-2 text-sm text-muted-foreground">
            One-time reviewers must use the unique secure link sent to them.
          </div>
        </div>
      </div>
    </div>
  );
}
