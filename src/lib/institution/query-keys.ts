export const institutionQueryKeys = {
  auth: ["institution", "auth"] as const,
  dashboard: (organizationId?: string) =>
    ["institution", "dashboard", organizationId ?? "none"] as const,
  verifications: (organizationId?: string) =>
    ["institution", "verifications", organizationId ?? "none"] as const,
  verificationInbox: (
    organizationId?: string,
    filters?: Record<string, string | number | boolean | undefined>,
  ) => ["institution", "verification-inbox", organizationId ?? "none", filters ?? {}] as const,
  verificationSummaryCount: (
    organizationId: string | undefined,
    category: string,
    status: string,
  ) =>
    [
      "institution",
      "verification-summary-count",
      organizationId ?? "none",
      category,
      status,
    ] as const,
  verification: (requestId: string) => ["institution", "verification", requestId] as const,
  verificationEvidence: (requestId: string) =>
    ["institution", "verification", requestId, "evidence"] as const,
  verificationTimeline: (requestId: string) =>
    ["institution", "verification", requestId, "timeline"] as const,
  people: (
    organizationId?: string,
    filters?: Record<string, string | number | boolean | undefined>,
  ) => ["institution", "people", organizationId ?? "none", filters ?? {}] as const,
  person: (organizationId: string | undefined, personId: string) =>
    ["institution", "person", organizationId ?? "none", personId] as const,
  personVerificationHistory: (organizationId: string | undefined, personId: string) =>
    ["institution", "person", organizationId ?? "none", personId, "verification-history"] as const,
  personCredentials: (organizationId: string | undefined, personId: string) =>
    ["institution", "person", organizationId ?? "none", personId, "credentials"] as const,
  personPassportSummary: (organizationId: string | undefined, personId: string) =>
    ["institution", "person", organizationId ?? "none", personId, "passport-summary"] as const,
  team: (organizationId?: string) => ["institution", "team", organizationId ?? "none"] as const,
  settings: (organizationId?: string) =>
    ["institution", "settings", organizationId ?? "none"] as const,
  notifications: (filters?: Record<string, string | number | boolean | undefined>) =>
    ["institution", "notifications", filters ?? {}] as const,
  notificationUnreadCount: ["institution", "notifications", "unread-count"] as const,
  magicLink: (token: string) => ["institution", "magic-link", token] as const,
};
