export type InstitutionErrorCode =
  | "UNAUTHORIZED"
  | "AUTH_EXPIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "INVALID_CREDENTIALS"
  | "SERVICE_UNAVAILABLE"
  | "API_NOT_CONFIGURED";

export class InstitutionError extends Error {
  code: InstitutionErrorCode;
  status: number;
  retryable: boolean;
  uiMessage: string;

  constructor(options: {
    code: InstitutionErrorCode;
    message: string;
    uiMessage: string;
    status?: number;
    retryable?: boolean;
  }) {
    super(options.message);
    this.name = "InstitutionError";
    this.code = options.code;
    this.status = options.status ?? 500;
    this.retryable = options.retryable ?? false;
    this.uiMessage = options.uiMessage;
  }
}

export function isInstitutionError(error: unknown): error is InstitutionError {
  return error instanceof InstitutionError;
}

export function getInstitutionErrorMessage(
  error: unknown,
  fallback = "We couldn't complete that action. Please try again.",
) {
  return isInstitutionError(error) ? error.uiMessage : fallback;
}

export function invalidCredentialsError() {
  return new InstitutionError({
    code: "INVALID_CREDENTIALS",
    message: "Invalid institution credentials.",
    uiMessage: "Invalid email or password.",
    status: 401,
  });
}

export function unauthorizedError() {
  return new InstitutionError({
    code: "UNAUTHORIZED",
    message: "Institution session is required.",
    uiMessage: "Your session has expired. Please sign in again.",
    status: 401,
  });
}

export function validationError(message: string) {
  return new InstitutionError({
    code: "VALIDATION",
    message,
    uiMessage: message,
    status: 422,
  });
}

export function forbiddenError(message = "You do not have permission for this action.") {
  return new InstitutionError({
    code: "FORBIDDEN",
    message,
    uiMessage: message,
    status: 403,
  });
}

export function notFoundError(message = "The requested resource was not found.") {
  return new InstitutionError({
    code: "NOT_FOUND",
    message,
    uiMessage: message,
    status: 404,
  });
}

export function conflictError(message: string) {
  return new InstitutionError({
    code: "CONFLICT",
    message,
    uiMessage: message,
    status: 409,
  });
}

export function serviceUnavailableError(message: string, uiMessage = message) {
  return new InstitutionError({
    code: "SERVICE_UNAVAILABLE",
    message,
    uiMessage,
    status: 503,
    retryable: true,
  });
}

export function apiNotConfiguredError(feature: string) {
  return new InstitutionError({
    code: "API_NOT_CONFIGURED",
    message: `${feature} is unavailable because institution backend APIs are not configured.`,
    uiMessage: `${feature} is not available yet. Please try again once institution backend access has been connected.`,
    status: 503,
    retryable: false,
  });
}
