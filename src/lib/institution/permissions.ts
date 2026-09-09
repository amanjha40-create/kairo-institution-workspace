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
  member: {
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
  if (session.permissionFlags) {
    return {
      canViewVerificationRequests: session.permissionFlags.modifyVerification,
      canRespondToVerificationRequests: session.permissionFlags.modifyVerification,
      canViewPeople: session.permissionFlags.modifyPerson,
      canManageTeam: session.permissionFlags.manageTeam,
      canManageSettings: session.permissionFlags.saveSettings,
      canManageOwnerActions: session.permissionFlags.transferOwnership,
      canAssignOwnerRole: session.permissionFlags.transferOwnership,
    };
  }
  return rolePermissions[session.role];
}
