import { institutionDemoModeEnabled } from "./config";
import { apiNotConfiguredError } from "./errors";
import type { Session } from "./types";

const DEMO_SESSION_KEY = "kairo.institution.demo.session";

export function createMockApprovedInstitutionSession(input: {
  name: string;
  email: string;
  institutionName: string;
}): void {
  if (!institutionDemoModeEnabled || typeof window === "undefined") {
    throw apiNotConfiguredError("Institution workspace preview");
  }

  const session: Session = {
    userId: `u_demo_${Date.now()}`,
    membershipId: `membership_demo_${Date.now()}`,
    institutionId: `inst_demo_${Date.now()}`,
    name: input.name || "Institution Admin",
    email: input.email || "admin@example.edu",
    role: "owner",
    institutionName: input.institutionName || "Your Institution",
    accountStatus: "active",
    workspaceStatus: "active",
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
  };

  window.sessionStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(session));
}
