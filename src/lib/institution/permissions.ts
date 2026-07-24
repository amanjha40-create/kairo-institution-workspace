import type { Role, Session } from "./types";

export interface InstitutionPermissions {
  canViewVerificationRequests: boolean;
  canRespondToVerificationRequests: boolean;
  canViewPeople: boolean;
  canManageTeam: boolean;
  canManageSettings: boolean;
  canManageOwnerActions: boolean;
  canAssignOwnerRole: boolean;
}

const noPermissions: InstitutionPermissions = {
  canViewVerificationRequests: false,
  canRespondToVerificationRequests: false,
  canViewPeople: false,
  canManageTeam: false,
  canManageSettings: false,
  canManageOwnerActions: false,
  canAssignOwnerRole: false,
};

const rolePermissions: Record<Role, InstitutionPermissions> = {
  owner: {
    canViewVerificationRequests: true,
    canRespondToVerificationRequests: true,
    canViewPeople: true,
    canManageTeam: true,
    canManageSettings: true,
    canManageOwnerActions: true,
    canAssignOwnerRole: true,
  },
  admin: {
    canViewVerificationRequests: true,
    canRespondToVerificationRequests: true,
    canViewPeople: true,
    canManageTeam: true,
    canManageSettings: true,
    canManageOwnerActions: false,
    canAssignOwnerRole: false,
  },
  reviewer: {
    canViewVerificationRequests: true,
    canRespondToVerificationRequests: true,
    canViewPeople: true,
    canManageTeam: false,
    canManageSettings: false,
    canManageOwnerActions: false,
    canAssignOwnerRole: false,
  },
};

export function getInstitutionPermissions(session: Session | null | undefined) {
  if (!session) return noPermissions;
  return rolePermissions[session.role];
}
