import { z } from "zod";

const DEVELOPMENT_API_FALLBACK = "http://localhost:8000";

const rawConfigSchema = z.object({
  VITE_APP_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
  VITE_DEMO_MODE: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  VITE_API_BASE_URL: z
    .string()
    .trim()
    .url("VITE_API_BASE_URL must be an absolute URL when provided.")
    .optional()
    .or(z.literal("")),
  VITE_ERROR_REPORTING_DSN: z.string().trim().optional().or(z.literal("")),
});

export interface InstitutionAppConfig {
  appEnv: "development" | "test" | "staging" | "production";
  demoMode: boolean;
  productionMode: boolean;
  apiBaseUrl: string | null;
  errorReportingDsn: string | null;
  backendConfigured: boolean;
}

export const institutionDemoModeEnabled = import.meta.env.VITE_DEMO_MODE === "true";

const parsedConfig = rawConfigSchema.safeParse(import.meta.env);

let configError: string | null = null;
let config: InstitutionAppConfig = {
  appEnv: "development",
  demoMode: false,
  productionMode: true,
  apiBaseUrl: null,
  errorReportingDsn: null,
  backendConfigured: false,
};

if (!parsedConfig.success) {
  configError =
    "Environment configuration is invalid. Review the public app environment variables before starting the Institution Workspace.";
} else {
  const env = parsedConfig.data;
  const configuredApiBaseUrl = env.VITE_API_BASE_URL?.trim() ? env.VITE_API_BASE_URL.trim() : null;
  const demoMode = env.VITE_DEMO_MODE ?? false;
  const isDevelopment = env.VITE_APP_ENV === "development";
  const apiBaseUrl = configuredApiBaseUrl ?? (isDevelopment ? DEVELOPMENT_API_FALLBACK : null);

  if (env.VITE_APP_ENV === "production" && demoMode) {
    configError =
      "Production builds cannot enable demo mode. Set VITE_DEMO_MODE=false before deploying.";
  } else if (env.VITE_APP_ENV === "production" && !configuredApiBaseUrl) {
    configError =
      "Production builds require VITE_API_BASE_URL to be set to the HTTPS Kairo API origin.";
  } else if (
    env.VITE_APP_ENV === "production" &&
    configuredApiBaseUrl &&
    !configuredApiBaseUrl.startsWith("https://")
  ) {
    configError = "Production builds require VITE_API_BASE_URL to use an HTTPS origin.";
  } else {
    config = {
      appEnv: env.VITE_APP_ENV,
      demoMode,
      productionMode: !demoMode,
      apiBaseUrl,
      errorReportingDsn: env.VITE_ERROR_REPORTING_DSN?.trim() || null,
      backendConfigured: Boolean(apiBaseUrl),
    };
  }
}

export const institutionAppConfig = config;
export const institutionAppConfigError = configError;

export function getInstitutionModeLabel() {
  return institutionAppConfig.demoMode ? "Demo Mode" : "Production Mode";
}

export function getProductionBackendStatusMessage() {
  if (institutionAppConfig.backendConfigured) {
    return "Institution backend endpoints can be connected through the typed adapters once the API contract is approved.";
  }

  return "Institution backend APIs are not configured yet. Production mode stays read-only and unavailable rather than simulating success.";
}
