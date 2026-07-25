import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  cancelTeamInvitation,
  getInstitutionTeam,
  inviteTeamMember,
  removeTeamMember,
  resendTeamInvitation,
  restoreTeamMember,
  suspendTeamMember,
  transferTeamOwnership,
  updateTeamMemberRole,
} from "@/lib/institution/api";
import { getInstitutionErrorMessage, isInstitutionError } from "@/lib/institution/errors";
import { getInstitutionPermissions } from "@/lib/institution/permissions";
import { institutionQueryKeys } from "@/lib/institution/query-keys";
import { LoadingState, ErrorState } from "@/components/institution/PageStates";
import {
  PermissionDeniedState,
  ServiceUnavailableState,
} from "@/components/institution/PageStates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useInstitutionAuth } from "@/lib/institution/auth";
import { toast } from "sonner";
import type { Role, TeamInvitation, TeamMember } from "@/lib/institution/types";
import { formatDateTime } from "@/lib/institution/format";

export const Route = createFileRoute("/institution/team")({
  component: TeamPage,
});

function TeamPage() {
  const qc = useQueryClient();
  const { session, refreshSession } = useInstitutionAuth();
  const permissions = getInstitutionPermissions(session);
  const organizationId = session?.institutionId;
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: institutionQueryKeys.team(organizationId),
    queryFn: () => {
      if (!organizationId) {
        throw new Error("An active institution context is required.");
      }
      return getInstitutionTeam(organizationId);
    },
    enabled: Boolean(organizationId),
  });
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamInvitation["role"]>("reviewer");
  const [transferTarget, setTransferTarget] = useState<TeamMember | null>(null);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: institutionQueryKeys.team(organizationId) });

  const members = data?.members ?? [];
  const invitations = data?.invitations ?? [];
  const pendingInvitations = invitations.filter((invitation) => invitation.status === "pending");
  const invitationHistory = invitations.filter((invitation) => invitation.status !== "pending");
  const activeOwners = members.filter(
    (member) => member.role === "owner" && member.status === "active",
  );

  if (!permissions.canManageTeam) return <PermissionDeniedState />;
  if (isError && isInstitutionError(error) && error.status === 503) {
    return (
      <ServiceUnavailableState
        title="Team management is unavailable"
        description={error.uiMessage}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage members of your institution's Trust Workspace.
          </p>
        </div>
        {permissions.canManageTeam && (
          <Button onClick={() => setInviteOpen(true)}>Invite member</Button>
        )}
      </div>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Last Active</th>
                <th className="px-4 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {members.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-sm text-muted-foreground" colSpan={6}>
                    No team members found for this institution.
                  </td>
                </tr>
              ) : (
                members.map((m) => (
                  <TeamRow
                    key={m.id}
                    member={m}
                    currentUserEmail={session?.email ?? null}
                    canManage={permissions.canManageTeam}
                    canManageOwnerActions={permissions.canManageOwnerActions}
                    isLastOwner={m.role === "owner" && activeOwners.length <= 1}
                    onRoleChange={async (role) => {
                      if (!organizationId) return;
                      try {
                        await updateTeamMemberRole(organizationId, m.id, role);
                        invalidate();
                        toast.success("Role updated");
                      } catch (err) {
                        toast.error(getInstitutionErrorMessage(err));
                      }
                    }}
                    onSuspend={async () => {
                      if (!organizationId) return;
                      try {
                        await suspendTeamMember(organizationId, m.id);
                        invalidate();
                        toast.success("Member suspended");
                      } catch (err) {
                        toast.error(getInstitutionErrorMessage(err));
                      }
                    }}
                    onRestore={async () => {
                      if (!organizationId) return;
                      try {
                        await restoreTeamMember(organizationId, m.id);
                        invalidate();
                        toast.success("Member restored");
                      } catch (err) {
                        toast.error(getInstitutionErrorMessage(err));
                      }
                    }}
                    onRemove={async () => {
                      if (!organizationId) return;
                      try {
                        await removeTeamMember(organizationId, m.id);
                        invalidate();
                        toast.success("Member removed");
                      } catch (err) {
                        toast.error(getInstitutionErrorMessage(err));
                      }
                    }}
                    onTransferOwnership={() => setTransferTarget(m)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Pending invitations</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Invitations awaiting acceptance remain scoped to this institution workspace.
          </p>
        </div>
        <div className="overflow-hidden rounded-lg border border-border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="px-4 py-2 font-medium">Invited</th>
                <th className="px-4 py-2 font-medium">Expires</th>
                <th className="px-4 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pendingInvitations.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-sm text-muted-foreground" colSpan={5}>
                    No pending invitations.
                  </td>
                </tr>
              ) : (
                pendingInvitations.map((invitation) => (
                  <InvitationRow
                    key={invitation.id}
                    invitation={invitation}
                    onResend={async () => {
                      if (!organizationId) return;
                      try {
                        await resendTeamInvitation(organizationId, invitation.id);
                        invalidate();
                        toast.success("Invitation resent");
                      } catch (err) {
                        toast.error(getInstitutionErrorMessage(err));
                      }
                    }}
                    onCancel={async () => {
                      if (!organizationId) return;
                      try {
                        await cancelTeamInvitation(organizationId, invitation.id);
                        invalidate();
                        toast.success("Invitation cancelled");
                      } catch (err) {
                        toast.error(getInstitutionErrorMessage(err));
                      }
                    }}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Invitation history</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Recent accepted, declined, cancelled, and expired invitations.
          </p>
        </div>
        <div className="overflow-hidden rounded-lg border border-border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invitationHistory.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-sm text-muted-foreground" colSpan={4}>
                    No invitation history yet.
                  </td>
                </tr>
              ) : (
                invitationHistory.map((invitation) => (
                  <InvitationHistoryRow key={invitation.id} invitation={invitation} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite member</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Work email</Label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div>
              <Label>Role</Label>
              <Select
                value={inviteRole}
                onValueChange={(value) => setInviteRole(value as TeamInvitation["role"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reviewer">Reviewer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!inviteEmail.includes("@")}
              onClick={async () => {
                if (!organizationId) return;
                try {
                  await inviteTeamMember(organizationId, inviteEmail, inviteRole);
                  setInviteOpen(false);
                  setInviteEmail("");
                  setInviteRole("reviewer");
                  invalidate();
                  toast.success("Invitation sent");
                } catch (err) {
                  toast.error(getInstitutionErrorMessage(err));
                }
              }}
            >
              Send invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(transferTarget)}
        onOpenChange={(open) => !open && setTransferTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer ownership</DialogTitle>
            <DialogDescription>
              This transfers the active Owner role to another current team member. The current Owner
              becomes an Admin after the transfer completes.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-border bg-secondary/30 px-4 py-3 text-sm">
            {transferTarget ? (
              <>
                <p className="font-medium">{transferTarget.name}</p>
                <p className="text-muted-foreground">{transferTarget.email}</p>
              </>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!organizationId || !transferTarget) return;
                try {
                  await transferTeamOwnership(organizationId, transferTarget.id);
                  await refreshSession();
                  setTransferTarget(null);
                  invalidate();
                  toast.success("Ownership transferred");
                } catch (err) {
                  toast.error(getInstitutionErrorMessage(err));
                }
              }}
            >
              Confirm transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TeamRow({
  member,
  currentUserEmail,
  canManage,
  canManageOwnerActions,
  isLastOwner,
  onRoleChange,
  onSuspend,
  onRestore,
  onRemove,
  onTransferOwnership,
}: {
  member: TeamMember;
  currentUserEmail: string | null;
  canManage: boolean;
  canManageOwnerActions: boolean;
  isLastOwner: boolean;
  onRoleChange: (role: Exclude<Role, "owner">) => void;
  onSuspend: () => void;
  onRestore: () => void;
  onRemove: () => void;
  onTransferOwnership: () => void;
}) {
  const protectedMember =
    (isLastOwner && member.role === "owner" && member.status === "active") ||
    (!canManageOwnerActions && member.role === "owner");
  const currentUser = currentUserEmail?.toLowerCase() === member.email.toLowerCase();
  const disableRoleSelect = protectedMember || currentUser || member.role === "owner";
  const disableLifecycleActions = protectedMember || currentUser;
  return (
    <tr className="hover:bg-secondary/40">
      <td className="px-4 py-3 font-medium">{member.name}</td>
      <td className="px-4 py-3 text-muted-foreground">{member.email}</td>
      <td className="px-4 py-3">
        {canManage && !disableRoleSelect ? (
          <Select
            value={member.role}
            onValueChange={(value) => onRoleChange(value as Exclude<Role, "owner">)}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="reviewer">Reviewer</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <span className="capitalize">{member.role}</span>
        )}
      </td>
      <td className="px-4 py-3">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
            member.status === "active"
              ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
              : member.status === "pending"
                ? "bg-amber-50 text-amber-800 ring-amber-200"
                : "bg-slate-100 text-slate-700 ring-slate-200"
          }`}
        >
          {member.status[0].toUpperCase() + member.status.slice(1)}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {member.lastActive ? formatDateTime(member.lastActive) : "—"}
      </td>
      <td className="px-4 py-3 text-right">
        {canManage ? (
          <div className="inline-flex flex-wrap justify-end gap-1">
            {member.status === "suspended" ? (
              <Button size="sm" variant="outline" disabled={currentUser} onClick={onRestore}>
                Restore
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                disabled={disableLifecycleActions}
                onClick={onSuspend}
              >
                Suspend
              </Button>
            )}
            {canManageOwnerActions && member.status === "active" && member.role !== "owner" && (
              <Button size="sm" variant="ghost" onClick={onTransferOwnership}>
                Transfer ownership
              </Button>
            )}
            <Button size="sm" variant="ghost" disabled={disableLifecycleActions} onClick={onRemove}>
              Remove
            </Button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
}

function InvitationRow({
  invitation,
  onResend,
  onCancel,
}: {
  invitation: TeamInvitation;
  onResend: () => void;
  onCancel: () => void;
}) {
  return (
    <tr className="hover:bg-secondary/40">
      <td className="px-4 py-3 text-muted-foreground">{invitation.email}</td>
      <td className="px-4 py-3 capitalize">{invitation.role}</td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {formatDateTime(invitation.invitedAt)}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {invitation.expiresAt ? formatDateTime(invitation.expiresAt) : "—"}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="inline-flex flex-wrap justify-end gap-1">
          <Button size="sm" variant="outline" onClick={onResend}>
            Resend
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </td>
    </tr>
  );
}

function InvitationHistoryRow({ invitation }: { invitation: TeamInvitation }) {
  const updatedAt =
    invitation.acceptedAt ||
    invitation.declinedAt ||
    invitation.cancelledAt ||
    invitation.expiresAt ||
    invitation.invitedAt;

  return (
    <tr className="hover:bg-secondary/40">
      <td className="px-4 py-3 text-muted-foreground">{invitation.email}</td>
      <td className="px-4 py-3 capitalize">{invitation.role}</td>
      <td className="px-4 py-3">
        <span className="capitalize">{invitation.status}</span>
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {updatedAt ? formatDateTime(updatedAt) : "—"}
      </td>
    </tr>
  );
}
