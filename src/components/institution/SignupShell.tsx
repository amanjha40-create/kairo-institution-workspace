import type { ReactNode } from "react";
import { PublicHeader } from "./PublicHeader";
import { SignupProgress, type SignupStepKey } from "./SignupProgress";

export function SignupShell({
  step,
  title,
  description,
  children,
}: {
  step: SignupStepKey;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-white to-[color:var(--kairo-teal-soft)]">
      <PublicHeader />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <div className="mb-6 sm:mb-8">
          <SignupProgress current={step} />
        </div>
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
        </div>
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
