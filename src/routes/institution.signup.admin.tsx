import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { SignupShell } from "@/components/institution/SignupShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  getInstitutionSignupDraft,
  updateInstitutionAdministrator,
  type InstitutionAdministrator,
} from "@/lib/institution/signup";

export const Route = createFileRoute("/institution/signup/admin")({
  head: () => ({
    meta: [
      { title: "Administrator — Create Institution Workspace" },
      {
        name: "description",
        content: "Add the primary administrator for your Kairo institution workspace.",
      },
      { property: "og:title", content: "Administrator — Kairo" },
      {
        property: "og:description",
        content: "Add the primary administrator for your Kairo workspace.",
      },
    ],
  }),
  component: AdminStep,
});

const schema = z
  .object({
    fullName: z.string().trim().min(2, "Full name is required").max(120),
    jobTitle: z.string().trim().min(2, "Job title is required").max(120),
    workEmail: z.string().trim().email("Enter a valid work email").max(200),
    phone: z.string().trim().max(40).optional().or(z.literal("")),
    password: z.string().min(12, "Password must be at least 12 characters").max(200),
    confirmPassword: z.string().min(12, "Confirm your password").max(200),
    authorized: z.literal(true, {
      errorMap: () => ({ message: "You must confirm your authority" }),
    }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

function AdminStep() {
  const navigate = useNavigate();
  const [form, setForm] = useState<InstitutionAdministrator>({
    fullName: "",
    jobTitle: "",
    workEmail: "",
    phone: "",
    password: "",
    confirmPassword: "",
    authorized: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const draft = getInstitutionSignupDraft();
    if (!draft) {
      navigate({ to: "/institution/signup/institution", replace: true });
      return;
    }
    setForm(draft.administrator);
  }, [navigate]);

  const update = <K extends keyof InstitutionAdministrator>(k: K, v: InstitutionAdministrator[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const map: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        map[String(i.path[0])] = i.message;
      });
      setErrors(map);
      return;
    }
    setErrors({});
    updateInstitutionAdministrator(form);
    navigate({ to: "/institution/signup/verify" });
  };

  return (
    <SignupShell
      step="admin"
      title="Administrator details"
      description="The primary administrator signs in with their work email. Phone verification is not required for this flow."
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" error={errors.fullName}>
            <Input value={form.fullName} onChange={(e) => update("fullName", e.target.value)} />
          </Field>
          <Field label="Job title" error={errors.jobTitle}>
            <Input value={form.jobTitle} onChange={(e) => update("jobTitle", e.target.value)} />
          </Field>
          <Field label="Work email" error={errors.workEmail}>
            <Input
              type="email"
              value={form.workEmail}
              onChange={(e) => update("workEmail", e.target.value)}
            />
          </Field>
          <Field label="Phone number (optional)" error={errors.phone}>
            <Input value={form.phone ?? ""} onChange={(e) => update("phone", e.target.value)} />
          </Field>
          <Field label="Password" error={errors.password}>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
            />
          </Field>
          <Field label="Confirm password" error={errors.confirmPassword}>
            <Input
              type="password"
              value={form.confirmPassword}
              onChange={(e) => update("confirmPassword", e.target.value)}
            />
          </Field>
        </div>
        <div className="flex items-start gap-2 rounded-md border border-border bg-secondary/40 p-3">
          <Checkbox
            id="authorized"
            checked={form.authorized}
            onCheckedChange={(v) => update("authorized", v === true)}
          />
          <label htmlFor="authorized" className="text-xs text-foreground">
            I confirm that I am authorized to create or request access to this institution's Kairo
            workspace.
          </label>
        </div>
        {errors.authorized && <p className="text-xs text-rose-700">{errors.authorized}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <Button asChild variant="ghost" type="button">
            <Link to="/institution/signup/institution">Back</Link>
          </Button>
          <Button type="submit">Continue</Button>
        </div>
      </form>
    </SignupShell>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1">{children}</div>
      {error && <p className="mt-1 text-xs text-rose-700">{error}</p>}
    </div>
  );
}
