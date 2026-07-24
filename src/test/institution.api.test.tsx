import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

async function importApiModule(demoMode: "true" | "false") {
  vi.resetModules();
  vi.stubEnv("VITE_APP_ENV", "test");
  vi.stubEnv("VITE_DEMO_MODE", demoMode);
  vi.stubEnv("VITE_API_BASE_URL", "");
  return import("@/lib/institution/api");
}

describe("institution repositories and public verification flows", () => {
  it("distinguishes not shared from not available", async () => {
    const { ProfessionalInfoValue } =
      await import("@/components/institution/ProfessionalInfoValue");
    const { rerender } = render(<ProfessionalInfoValue consented={false} />);

    expect(screen.getByText("Not shared")).toBeInTheDocument();

    rerender(<ProfessionalInfoValue consented value={undefined} />);
    expect(screen.getByText("Not available")).toBeInTheDocument();
  });

  it("protects the final active owner from removal", async () => {
    const api = await importApiModule("true");

    await expect(api.removeTeamMember("u_priya")).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("returns expired, completed, revoked, and invalid magic-link states", async () => {
    const api = await importApiModule("true");

    await expect(
      api.getPublicInstitutionVerificationByToken("expired-token"),
    ).resolves.toMatchObject({
      state: "expired",
    });
    await expect(
      api.getPublicInstitutionVerificationByToken("completed-token"),
    ).resolves.toMatchObject({
      state: "completed",
    });
    await expect(
      api.getPublicInstitutionVerificationByToken("revoked-token"),
    ).resolves.toMatchObject({
      state: "revoked",
    });
    await expect(
      api.getPublicInstitutionVerificationByToken("missing-token"),
    ).resolves.toMatchObject({
      state: "invalid",
    });
  });

  it("prevents double submission of a magic-link confirmation", async () => {
    const api = await importApiModule("true");

    await expect(
      api.confirmPublicInstitutionVerification("valid-token", {
        note: "Matches institution record",
      }),
    ).resolves.toMatchObject({
      state: "completed",
    });

    await expect(
      api.confirmPublicInstitutionVerification("valid-token", { note: "Second attempt" }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("supports confirm, discrepancy, and clarification in demo mode and fails closed in production", async () => {
    let api = await importApiModule("true");
    await expect(
      api.confirmPublicInstitutionVerification("valid-token", { note: "Confirmed" }),
    ).resolves.toMatchObject({
      state: "completed",
    });

    api = await importApiModule("true");
    await expect(
      api.reportPublicInstitutionVerificationDiscrepancy("valid-token", {
        fields: ["Degree"],
        explanation: "Degree differs from institution record.",
      }),
    ).resolves.toMatchObject({
      state: "completed",
    });

    api = await importApiModule("true");
    await expect(
      api.requestPublicInstitutionVerificationClarification("valid-token", {
        fields: ["Supporting document"],
        message: "Please share your official transcript.",
        requestDocument: true,
      }),
    ).resolves.toMatchObject({
      state: "completed",
    });

    api = await importApiModule("false");
    await expect(
      api.confirmPublicInstitutionVerification("valid-token", { note: "Confirmed" }),
    ).rejects.toMatchObject({
      code: "API_NOT_CONFIGURED",
    });
  });
});
