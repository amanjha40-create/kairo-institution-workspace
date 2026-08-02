import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  completeInstitutionPasswordReset,
  getInstitutionWorkspaceBootstrap,
  getStoredInstitutionAuthTokens,
  loginInstitutionUser,
  logoutInstitutionUser,
  refreshInstitutionUserSession,
  requestInstitutionPasswordReset,
  storeInstitutionAuthTokens,
} from "./backend";
import { institutionAppConfig } from "./config";
import { apiNotConfiguredError, invalidCredentialsError, type InstitutionError } from "./errors";
import type { InstitutionWorkspaceBootstrap, Session } from "./types";

const DEMO_BUILD = import.meta.env.VITE_DEMO_MODE === "true";
const DEMO_SESSION_KEY = "kairo.institution.demo.session";
const loadDemoFixtures = DEMO_BUILD ? () => import("./mock-data") : null;

export interface InstitutionAuthState {
  session: Session | null;
  bootstrap: InstitutionWorkspaceBootstrap | null;
  authenticated: boolean;
  error: InstitutionError | null;
}

export interface InstitutionAuthAdapter {
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  getCurrentInstitutionSession: () => Promise<InstitutionAuthState>;
  refreshSession: () => Promise<InstitutionAuthState>;
  requestPasswordReset: (email: string) => Promise<void>;
  completePasswordReset: (token: string, password: string) => Promise<void>;
}

interface AuthContextValue extends InstitutionAuthState {
  hydrated: boolean;
  isDemoMode: boolean;
  signIn: (email: string, password: string) => Promise<Session | null>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<Session | null>;
  requestPasswordReset: (email: string) => Promise<void>;
  completePasswordReset: (token: string, password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function safeReadDemoSession() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(DEMO_SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function safeWriteDemoSession(session: Session | null) {
  if (typeof window === "undefined") return;

  try {
    if (!session) {
      window.sessionStorage.removeItem(DEMO_SESSION_KEY);
      return;
    }

    window.sessionStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(session));
  } catch {
    // Best effort only for demo mode.
  }
}

async function buildDemoSession(email: string): Promise<Session> {
  if (!loadDemoFixtures) {
    throw invalidCredentialsError();
  }

  const { mockInstitution, mockTeam } = await loadDemoFixtures();
  const member = mockTeam.find(
    (candidate) =>
      candidate.email.toLowerCase() === email.toLowerCase() && candidate.status === "active",
  );

  if (!member) {
    throw invalidCredentialsError();
  }

  return {
    userId: member.id,
    membershipId: `membership_${member.id}`,
    institutionId: mockInstitution.id,
    name: member.name,
    email: member.email,
    role: member.role,
    institutionName: mockInstitution.name,
    accountStatus: "active",
    workspaceStatus: "active",
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
  };
}

function mapBootstrapToSession(
  bootstrap: InstitutionWorkspaceBootstrap,
  expiresAt?: string,
): Session | null {
  const organization = bootstrap.activeOrganization;
  if (
    !organization ||
    organization.organizationType !== "university" ||
    !bootstrap.membershipRole
  ) {
    return null;
  }

  const workspaceStatus =
    bootstrap.organizationSuspended || bootstrap.membershipSuspended
      ? "suspended"
      : bootstrap.state === "ready"
        ? "active"
        : bootstrap.state === "setup_incomplete" || bootstrap.state === "verification_pending"
          ? "pending_review"
          : "inactive";

  return {
    userId: bootstrap.currentUser.id,
    institutionId: organization.publicId,
    name: bootstrap.currentUser.fullName || bootstrap.currentUser.email,
    email: bootstrap.currentUser.email,
    role: bootstrap.membershipRole,
    institutionName: organization.name,
    accountStatus: bootstrap.membershipSuspended ? "suspended" : "active",
    workspaceStatus,
    expiresAt,
    permissionFlags: bootstrap.permissionFlags,
    workspaceAccessState: bootstrap.state,
    organizationVerificationState: bootstrap.organizationVerificationState,
  };
}

async function resolveProductionAuthState(forceRefresh = false): Promise<InstitutionAuthState> {
  if (!institutionAppConfig.backendConfigured) {
    return {
      session: null,
      bootstrap: null,
      authenticated: false,
      error: null,
    };
  }

  const stored = getStoredInstitutionAuthTokens();
  if (!stored) {
    return {
      session: null,
      bootstrap: null,
      authenticated: false,
      error: null,
    };
  }

  let nextTokens = stored;

  if (forceRefresh || new Date(stored.expiresAt).getTime() <= Date.now()) {
    try {
      nextTokens = await refreshInstitutionUserSession(stored.refreshToken);
    } catch (error) {
      storeInstitutionAuthTokens(null);
      return {
        session: null,
        bootstrap: null,
        authenticated: false,
        error: null,
      };
    }
  }

  try {
    const bootstrap = await getInstitutionWorkspaceBootstrap(nextTokens.accessToken);
    return {
      session: mapBootstrapToSession(bootstrap, nextTokens.expiresAt),
      bootstrap,
      authenticated: true,
      error: null,
    };
  } catch (error) {
    if (error instanceof Error && "status" in error && (error as InstitutionError).status === 401) {
      try {
        nextTokens = await refreshInstitutionUserSession(nextTokens.refreshToken);
        const bootstrap = await getInstitutionWorkspaceBootstrap(nextTokens.accessToken);
        return {
          session: mapBootstrapToSession(bootstrap, nextTokens.expiresAt),
          bootstrap,
          authenticated: true,
          error: null,
        };
      } catch {
        storeInstitutionAuthTokens(null);
        return {
          session: null,
          bootstrap: null,
          authenticated: false,
          error: null,
        };
      }
    }

    return {
      session: null,
      bootstrap: null,
      authenticated: true,
      error: error as InstitutionError,
    };
  }
}

function getInstitutionAuthAdapter(): InstitutionAuthAdapter {
  if (DEMO_BUILD) {
    return {
      async signIn(email: string, password: string) {
        if (password !== "demo-password") {
          throw invalidCredentialsError();
        }

        const session = await buildDemoSession(email);
        safeWriteDemoSession(session);
      },
      async signOut() {
        safeWriteDemoSession(null);
      },
      async getCurrentInstitutionSession() {
        const session = safeReadDemoSession();
        if (!session) {
          return {
            session: null,
            bootstrap: null,
            authenticated: false,
            error: null,
          };
        }
        if (session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) {
          safeWriteDemoSession(null);
          return {
            session: null,
            bootstrap: null,
            authenticated: false,
            error: null,
          };
        }

        return {
          session,
          bootstrap: null,
          authenticated: true,
          error: null,
        };
      },
      async refreshSession() {
        return this.getCurrentInstitutionSession();
      },
      async requestPasswordReset(email: string) {
        if (!loadDemoFixtures) {
          throw invalidCredentialsError();
        }

        const { mockTeam } = await loadDemoFixtures();
        const memberExists = mockTeam.some(
          (candidate) => candidate.email.toLowerCase() === email.toLowerCase(),
        );
        if (!memberExists) {
          throw invalidCredentialsError();
        }
      },
      async completePasswordReset() {
        throw apiNotConfiguredError("Password reset");
      },
    };
  }

  return {
    async signIn(email: string, password: string) {
      await loginInstitutionUser(email, password);
    },
    async signOut() {
      const stored = getStoredInstitutionAuthTokens();
      try {
        if (stored?.refreshToken) {
          await logoutInstitutionUser(stored.refreshToken);
        }
      } finally {
        storeInstitutionAuthTokens(null);
      }
    },
    async getCurrentInstitutionSession() {
      return resolveProductionAuthState(false);
    },
    async refreshSession() {
      return resolveProductionAuthState(true);
    },
    async requestPasswordReset(email: string) {
      await requestInstitutionPasswordReset(email);
    },
    async completePasswordReset(token: string, password: string) {
      await completeInstitutionPasswordReset(token, password);
    },
  };
}

export function InstitutionAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [bootstrap, setBootstrap] = useState<InstitutionWorkspaceBootstrap | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [authError, setAuthError] = useState<InstitutionError | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const adapter = useMemo(() => getInstitutionAuthAdapter(), []);

  useEffect(() => {
    let cancelled = false;

    void adapter.getCurrentInstitutionSession().then((state) => {
      if (cancelled) return;
      setSession(state.session);
      setBootstrap(state.bootstrap);
      setAuthenticated(state.authenticated);
      setAuthError(state.error);
      setHydrated(true);
    });

    return () => {
      cancelled = true;
    };
  }, [adapter]);

  const signIn = async (email: string, password: string) => {
    await adapter.signIn(email, password);
    const state = await adapter.getCurrentInstitutionSession();
    setSession(state.session);
    setBootstrap(state.bootstrap);
    setAuthenticated(state.authenticated);
    setAuthError(state.error);
    return state.session;
  };

  const signOut = async () => {
    await adapter.signOut();
    setSession(null);
    setBootstrap(null);
    setAuthenticated(false);
    setAuthError(null);
  };

  const refreshSession = async () => {
    const state = await adapter.refreshSession();
    setSession(state.session);
    setBootstrap(state.bootstrap);
    setAuthenticated(state.authenticated);
    setAuthError(state.error);
    return state.session;
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        bootstrap,
        authenticated,
        error: authError,
        hydrated,
        isDemoMode: institutionAppConfig.demoMode,
        signIn,
        signOut,
        refreshSession,
        requestPasswordReset: adapter.requestPasswordReset,
        completePasswordReset: adapter.completePasswordReset,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useInstitutionAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useInstitutionAuth must be used within InstitutionAuthProvider");
  return ctx;
}
