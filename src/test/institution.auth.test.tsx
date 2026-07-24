import { render, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";

const DEMO_SESSION_KEY = "kairo.institution.demo.session";

type AuthProbe = {
  hydrated: boolean;
  signIn: (email: string, password: string) => Promise<unknown>;
};

async function importAuthModule(demoMode: "true" | "false") {
  vi.resetModules();
  vi.stubEnv("VITE_APP_ENV", "test");
  vi.stubEnv("VITE_DEMO_MODE", demoMode);
  vi.stubEnv("VITE_API_BASE_URL", "");
  return import("@/lib/institution/auth");
}

async function renderAuthHarness(demoMode: "true" | "false") {
  const authModule = await importAuthModule(demoMode);
  let authState: AuthProbe | null = null;

  function Probe() {
    const auth = authModule.useInstitutionAuth();

    useEffect(() => {
      authState = {
        hydrated: auth.hydrated,
        signIn: auth.signIn,
      };
    }, [auth]);

    return null;
  }

  render(
    <authModule.InstitutionAuthProvider>
      <Probe />
    </authModule.InstitutionAuthProvider>,
  );

  await waitFor(() => expect(authState).not.toBeNull());
  await waitFor(() => expect(authState?.hydrated).toBe(true));
  return authState!;
}

describe("institution auth", () => {
  it("rejects invalid demo credentials without creating a session", async () => {
    const auth = await renderAuthHarness("true");

    await expect(
      auth.signIn("unknown.person@northbridge.edu", "demo-password"),
    ).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
    expect(window.sessionStorage.getItem(DEMO_SESSION_KEY)).toBeNull();
  });

  it("does not create a production session when institution auth is unavailable", async () => {
    const auth = await renderAuthHarness("false");

    await expect(auth.signIn("owner@example.edu", "not-a-real-password")).rejects.toMatchObject({
      code: "API_NOT_CONFIGURED",
    });
    expect(window.sessionStorage.getItem(DEMO_SESSION_KEY)).toBeNull();
  });
});
