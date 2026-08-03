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

  it("recovers from a stale signup session by starting a fresh one and preserving safe draft fields", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_APP_ENV", "test");
    vi.stubEnv("VITE_DEMO_MODE", "false");
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");

    const startOrganizationStaffSignup = vi.fn().mockResolvedValue({
      signupSessionId: "signup_session_002",
      emailMasked: "p***@northbridge.edu",
      emailVerified: false,
      resendAfterSeconds: 60,
      expiresInSeconds: 600,
      message: "Verification code sent.",
    });
    const sendOrganizationStaffSignupEmail = vi.fn().mockRejectedValue(
      new (await import("@/lib/institution/errors")).InstitutionError({
        code: "NOT_FOUND",
        message: "Signup session not found",
        uiMessage: "Signup session not found",
        status: 404,
      }),
    );

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
    signup.updateInstitutionDetails({
      name: "Northbridge University",
      city: "Delhi",
      country: "India",
    });
    signup.updateInstitutionAdministrator({
      fullName: "Priya Menon",
      jobTitle: "Registrar",
      workEmail: "priya.menon@northbridge.edu",
      authorized: true,
      password: "super-secret-password",
      confirmPassword: "super-secret-password",
    });
    signup.updateInstitutionVerification({
      method: "email",
      emailStatus: "code_sent",
      signupSessionId: "stale_signup_session",
      emailMasked: "old***@northbridge.edu",
      expiresInSeconds: 600,
    });

    const result = await signup.requestInstitutionEmailVerification();
    const draft = signup.getInstitutionSignupDraft();

    expect(sendOrganizationStaffSignupEmail).toHaveBeenCalledWith("stale_signup_session");
    expect(startOrganizationStaffSignup).toHaveBeenCalledTimes(1);
    expect(startOrganizationStaffSignup).toHaveBeenCalledWith({
      fullName: "Priya Menon",
      workEmail: "priya.menon@northbridge.edu",
      password: "super-secret-password",
    });
    expect(result.recovered).toBe(true);
    expect(draft?.verification.signupSessionId).toBe("signup_session_002");
    expect(draft?.verification.emailStatus).toBe("code_sent");
    expect(draft?.institution.name).toBe("Northbridge University");
    expect(draft?.administrator.password).toBe("super-secret-password");
  });

  it("derives the correct onboarding continuation step from safe draft fields", async () => {
    const signup = await importSignupModule("false");

    expect(signup.getInstitutionSignupContinuationPath()).toBe(
      signup.INSTITUTION_SIGNUP_ROUTES.institution,
    );

    signup.createInstitutionSignupDraft();
    signup.updateInstitutionDetails({
      name: "Northbridge University",
      type: "University",
      website: "https://northbridge.edu",
      domain: "northbridge.edu",
      country: "India",
      city: "Delhi",
      verificationEmail: "verify@northbridge.edu",
    });
    expect(signup.getInstitutionSignupContinuationPath()).toBe(
      signup.INSTITUTION_SIGNUP_ROUTES.admin,
    );

    signup.updateInstitutionAdministrator({
      fullName: "Priya Menon",
      jobTitle: "Registrar",
      workEmail: "priya.menon@northbridge.edu",
      authorized: true,
      password: "super-secret-password",
      confirmPassword: "super-secret-password",
    });
    expect(signup.getInstitutionSignupContinuationPath()).toBe(
      signup.INSTITUTION_SIGNUP_ROUTES.verify,
    );

    signup.updateInstitutionVerification({
      method: "email",
      emailStatus: "verified",
    });
    expect(signup.getInstitutionSignupContinuationPath()).toBe(
      signup.INSTITUTION_SIGNUP_ROUTES.review,
    );
  });
});
