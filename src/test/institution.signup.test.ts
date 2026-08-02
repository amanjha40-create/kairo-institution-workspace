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

  it("uses signup start for the initial OTP request without forcing an immediate resend", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_APP_ENV", "test");
    vi.stubEnv("VITE_DEMO_MODE", "false");
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");

    const startOrganizationStaffSignup = vi.fn().mockResolvedValue({
      signupSessionId: "signup_session_001",
      emailMasked: "p***@northbridge.edu",
      emailVerified: false,
      resendAfterSeconds: 60,
      expiresInSeconds: 600,
      message: "Verification code sent.",
    });
    const sendOrganizationStaffSignupEmail = vi.fn();

    vi.doMock("@/lib/institution/backend", async () => {
      const actual = await vi.importActual<typeof import("@/lib/institution/backend")>(
        "@/lib/institution/backend",
      );

      return {
        ...actual,
        startOrganizationStaffSignup,
        sendOrganizationStaffSignupEmail,
      };
    });

    const signup = await import("@/lib/institution/signup");

    signup.createInstitutionSignupDraft();
    signup.updateInstitutionAdministrator({
      fullName: "Priya Menon",
      jobTitle: "Registrar",
      workEmail: "priya.menon@northbridge.edu",
      authorized: true,
      password: "super-secret-password",
      confirmPassword: "super-secret-password",
    });

    await signup.requestInstitutionEmailVerification();

    expect(startOrganizationStaffSignup).toHaveBeenCalledTimes(1);
    expect(sendOrganizationStaffSignupEmail).not.toHaveBeenCalled();
  });
});
