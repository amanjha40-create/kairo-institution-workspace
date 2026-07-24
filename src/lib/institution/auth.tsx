import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "./types";
import { institutionAppConfig } from "./config";
import { apiNotConfiguredError, invalidCredentialsError, serviceUnavailableError } from "./errors";
import { mockInstitution, mockTeam } from "./mock-data";

const DEMO_SESSION_KEY = "kairo.institution.demo.session";

export interface InstitutionAuthAdapter {
  signIn: (email: string, password: string) => Promise<Session>;
  signOut: () => Promise<void>;
  getCurrentInstitutionSession: () => Promise<Session | null>;
  refreshSession: () => Promise<Session | null>;
  requestPasswordReset: (email: string) => Promise<void>;
  completePasswordReset: (token: string, password: string) => Promise<void>;
}

interface AuthContextValue {
  session: Session | null;
  hydrated: boolean;
  isDemoMode: boolean;
  signIn: (email: string, password: string) => Promise<Session>;
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

function buildDemoSession(email: string): Session {
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

function getInstitutionAuthAdapter(): InstitutionAuthAdapter {
  if (institutionAppConfig.demoMode) {
    return {
      async signIn(email: string, password: string) {
        if (password !== "demo-password") {
          throw invalidCredentialsError();
        }

        const session = buildDemoSession(email);
        safeWriteDemoSession(session);
        return session;
      },
      async signOut() {
        safeWriteDemoSession(null);
      },
      async getCurrentInstitutionSession() {
        const session = safeReadDemoSession();
        if (!session) return null;
        if (session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) {
          safeWriteDemoSession(null);
          return null;
        }
        return session;
      },
      async refreshSession() {
        return safeReadDemoSession();
      },
      async requestPasswordReset(email: string) {
        const memberExists = mockTeam.some(
          (candidate) => candidate.email.toLowerCase() === email.toLowerCase(),
        );
        if (!memberExists) {
          throw invalidCredentialsError();
        }
      },
      async completePasswordReset() {
        throw serviceUnavailableError(
          "Demo mode does not persist password resets.",
          "Demo mode cannot complete password resets.",
        );
      },
    };
  }

  return {
    async signIn() {
      throw apiNotConfiguredError("Institution sign in");
    },
    async signOut() {},
    async getCurrentInstitutionSession() {
      return null;
    },
    async refreshSession() {
      if (!institutionAppConfig.backendConfigured) return null;
      throw serviceUnavailableError(
        "Institution session refresh is not connected yet.",
        "Institution session refresh is not available yet.",
      );
    },
    async requestPasswordReset() {
      throw apiNotConfiguredError("Password reset");
    },
    async completePasswordReset() {
      throw apiNotConfiguredError("Password reset");
    },
  };
}

export function InstitutionAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const adapter = useMemo(() => getInstitutionAuthAdapter(), []);

  useEffect(() => {
    let cancelled = false;

    void adapter
      .getCurrentInstitutionSession()
      .then((nextSession) => {
        if (!cancelled) setSession(nextSession);
      })
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });

    return () => {
      cancelled = true;
    };
  }, [adapter]);

  const signIn = async (email: string, password: string) => {
    const next = await adapter.signIn(email, password);
    setSession(next);
    return next;
  };

  const signOut = async () => {
    await adapter.signOut();
    setSession(null);
  };

  const refreshSession = async () => {
    const next = await adapter.refreshSession();
    setSession(next);
    return next;
  };

  return (
    <AuthContext.Provider
      value={{
        session,
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
