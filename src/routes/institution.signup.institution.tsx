import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { SignupShell } from "@/components/institution/SignupShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createInstitutionSignupDraft,
  getInstitutionSignupDraft,
  isPersonalEmailDomain,
  updateInstitutionDetails,
  type InstitutionDetails,
  type InstitutionType,
} from "@/lib/institution/signup";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/institution/signup/institution")({
  head: () => ({
    meta: [
      { title: "Institution details — Create Institution Workspace" },
      {
        name: "description",
        content: "Tell us about your institution to begin creating a Kairo workspace.",
      },
      { property: "og:title", content: "Institution details — Kairo" },
      { property: "og:description", content: "Start creating your Institution Workspace." },
    ],
  }),
  component: InstitutionStep,
});

const INSTITUTION_TYPES: InstitutionType[] = [
  "University",
  "College",
  "School",
  "Training Institute",
  "Certification Body",
  "Other Educational Institution",
];

const schema = z.object({
  name: z.string().trim().min(2, "Institution name is required").max(200),
  type: z.string().min(1, "Select an institution type"),
  website: z.string().trim().url("Enter a valid website URL").max(300),
  domain: z.string().trim().min(3, "Enter your institution domain").max(200),
  country: z.string().trim().min(2, "Country is required").max(100),
  city: z.string().trim().min(2, "City is required").max(100),
  verificationEmail: z.string().trim().email("Enter a valid email").max(200),
});

function InstitutionStep() {
  const navigate = useNavigate();
  const [form, setForm] = useState<InstitutionDetails>({
    name: "",
    type: "",
    website: "",
    domain: "",
    country: "",
    city: "",
    verificationEmail: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    const draft = getInstitutionSignupDraft() ?? createInstitutionSignupDraft();
    setForm(draft.institution);
  }, []);

  const update = <K extends keyof InstitutionDetails>(key: K, value: InstitutionDetails[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (key === "verificationEmail") {
      const v = String(value);
      setWarning(
        v && isPersonalEmailDomain(v)
          ? "This looks like a personal email address. Additional review may be required."
          : null,
      );
    }
  };

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
    updateInstitutionDetails(form);
    navigate({ to: "/institution/signup/admin" });
  };

  return (
    <SignupShell
      step="institution"
      title="Tell us about your institution"
      description="We use these details to create your workspace and to route verification requests to the right team."
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Institution name" error={errors.name}>
            <Input
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              maxLength={200}
            />
          </Field>
          <Field label="Institution type" error={errors.type}>
            <select
              value={form.type}
              onChange={(e) => update("type", e.target.value as InstitutionType)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Select a type…</option>
              {INSTITUTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Official website" error={errors.website}>
            <Input
              placeholder="https://"
              value={form.website}
              onChange={(e) => update("website", e.target.value)}
            />
          </Field>
          <Field label="Official domain" error={errors.domain}>
            <Input
              placeholder="northbridge.edu"
              value={form.domain}
              onChange={(e) => update("domain", e.target.value)}
            />
          </Field>
          <Field label="Country" error={errors.country}>
            <Input value={form.country} onChange={(e) => update("country", e.target.value)} />
          </Field>
          <Field label="City" error={errors.city}>
            <Input value={form.city} onChange={(e) => update("city", e.target.value)} />
          </Field>
        </div>
        <Field label="Primary verification email" error={errors.verificationEmail}>
          <Input
            type="email"
            placeholder="verify@northbridge.edu"
            value={form.verificationEmail}
            onChange={(e) => update("verificationEmail", e.target.value)}
          />
          {warning && (
            <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5" />
              <span>{warning}</span>
            </div>
          )}
        </Field>
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <Button asChild variant="ghost" type="button">
            <Link to="/institution">Back to institution page</Link>
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
