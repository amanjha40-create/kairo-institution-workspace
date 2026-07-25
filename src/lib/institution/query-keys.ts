export const institutionQueryKeys = {
  auth: ["institution", "auth"] as const,
  verifications: () => ["institution", "verifications"] as const,
  verification: (requestId: string) => ["institution", "verification", requestId] as const,
  people: () => ["institution", "people"] as const,
  person: (personId: string) => ["institution", "person", personId] as const,
  team: (organizationId?: string) => ["institution", "team", organizationId ?? "none"] as const,
  settings: () => ["institution", "settings"] as const,
  magicLink: (token: string) => ["institution", "magic-link", token] as const,
};
