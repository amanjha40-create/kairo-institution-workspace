export function resolveInstitutionNotificationPath(
  metadata: Record<string, unknown> | undefined,
): string | null {
  const verificationRequestId = firstString(metadata, [
    "verification_request_public_id",
    "request_public_id",
  ]);

  if (verificationRequestId) {
    return `/institution/verifications/${verificationRequestId}`;
  }

  const personId = firstString(metadata, ["person_public_id"]);
  if (personId) {
    return `/institution/people/${personId}`;
  }

  return null;
}

function firstString(metadata: Record<string, unknown> | undefined, keys: string[]): string | null {
  for (const key of keys) {
    const value = metadata?.[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}
