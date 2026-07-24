import { describe, expect, it, vi } from "vitest";

async function importSignupModule(demoMode: "true" | "false") {
  vi.resetModules();
  vi.stubEnv("VITE_APP_ENV", "test");
  vi.stubEnv("VITE_DEMO_MODE", demoMode);
  vi.stubEnv("VITE_API_BASE_URL", "");
  return import("@/lib/institution/signup");
}

describe("institution signup storage", () => {
  it("never persists passwords in the signup draft", async () => {
    const signup = await importSignupModule("true");

    signup.createInstitutionSignupDraft();
    signup.updateInstitutionAdministrator({
      fullName: "Priya Menon",
      jobTitle: "Registrar",
      workEmail: "priya.menon@northbridge.edu",
      authorized: true,
      password: "super-secret-password",
      confirmPassword: "super-secret-password",
    });

    const storedDraft = window.localStorage.getItem("kairo.institution.signup.draft");

    expect(storedDraft).toBeTruthy();
    expect(storedDraft).not.toContain("super-secret-password");
    expect(JSON.parse(storedDraft as string).administrator.password).toBeUndefined();
    expect(signup.getInstitutionSignupDraft()?.administrator.password).toBe(
      "super-secret-password",
    );
  });

  it("keeps demo-only workspace preview unavailable when demo mode is disabled", async () => {
    const signup = await importSignupModule("false");

    expect(() =>
      signup.createMockApprovedInstitutionSession({
        name: "Priya Menon",
        email: "priya.menon@northbridge.edu",
        institutionName: "Northbridge University",
      }),
    ).toThrowError();
    expect(window.sessionStorage.getItem("kairo.institution.demo.session")).toBeNull();
  });
});
