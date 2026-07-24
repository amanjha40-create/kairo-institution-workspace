import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  getInstitutionTeam,
  inviteTeamMember,
  removeTeamMember,
  updateTeamMember,
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useInstitutionAuth } from "@/lib/institution/auth";
import { toast } from "sonner";
import type { Role, TeamMember } from "@/lib/institution/types";
import { formatDateTime } from "@/lib/institution/format";

export const Route = createFileRoute("/institution/team")({
  component: TeamPage,
});

function TeamPage() {
  const qc = useQueryClient();
  const { session } = useInstitutionAuth();
  const permissions = getInstitutionPermissions(session);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: institutionQueryKeys.team(),
    queryFn: getInstitutionTeam,
  });
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("reviewer");

  const invalidate = () => qc.invalidateQueries({ queryKey: institutionQueryKeys.team() });

  const activeOwners = (data ?? []).filter((m) => m.role === "owner" && m.status === "active");

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
              {(data ?? []).map((m) => (
                <TeamRow
                  key={m.id}
                  member={m}
                  canManage={permissions.canManageTeam}
                  canManageOwnerActions={permissions.canManageOwnerActions}
                  canAssignOwnerRole={permissions.canAssignOwnerRole}
                  isLastOwner={m.role === "owner" && activeOwners.length <= 1}
                  onUpdate={async (patch) => {
                    try {
                      await updateTeamMember(m.id, patch);
                      invalidate();
                      toast.success("Updated");
                    } catch (err) {
                      toast.error(getInstitutionErrorMessage(err));
                    }
                  }}
                  onRemove={async () => {
                    try {
                      await removeTeamMember(m.id);
                      invalidate();
                      toast.success("Member removed");
                    } catch (err) {
                      toast.error(getInstitutionErrorMessage(err));
                    }
                  }}
                  onResend={() => toast("Invitation resend is a demo-only preview.")}
                  onCancelInvite={async () => {
                    try {
                      await removeTeamMember(m.id);
                      invalidate();
                      toast.success("Invitation cancelled");
                    } catch (err) {
                      toast.error(getInstitutionErrorMessage(err));
                    }
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

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
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as Role)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reviewer">Reviewer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  {permissions.canAssignOwnerRole && <SelectItem value="owner">Owner</SelectItem>}
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
                try {
                  await inviteTeamMember(inviteEmail, inviteRole);
                  setInviteOpen(false);
                  setInviteEmail("");
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
    </div>
  );
}

function TeamRow({
  member,
  canManage,
  canManageOwnerActions,
  canAssignOwnerRole,
  isLastOwner,
  onUpdate,
  onRemove,
  onResend,
  onCancelInvite,
}: {
  member: TeamMember;
  canManage: boolean;
  canManageOwnerActions: boolean;
  canAssignOwnerRole: boolean;
  isLastOwner: boolean;
  onUpdate: (patch: Partial<TeamMember>) => void;
  onRemove: () => void;
  onResend: () => void;
  onCancelInvite: () => void;
}) {
  const protectedMember =
    (isLastOwner && member.role === "owner" && member.status === "active") ||
    (!canManageOwnerActions && member.role === "owner");
  return (
    <tr className="hover:bg-secondary/40">
      <td className="px-4 py-3 font-medium">{member.name}</td>
      <td className="px-4 py-3 text-muted-foreground">{member.email}</td>
      <td className="px-4 py-3">
        {canManage && !protectedMember ? (
          <Select value={member.role} onValueChange={(v) => onUpdate({ role: v as Role })}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="reviewer">Reviewer</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              {canAssignOwnerRole && <SelectItem value="owner">Owner</SelectItem>}
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
            {member.status === "pending" ? (
              <>
                <Button size="sm" variant="outline" onClick={onResend}>
                  Resend
                </Button>
                <Button size="sm" variant="ghost" onClick={onCancelInvite}>
                  Cancel
                </Button>
              </>
            ) : member.status === "suspended" ? (
              <Button size="sm" variant="outline" onClick={() => onUpdate({ status: "active" })}>
                Restore
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                disabled={protectedMember}
                onClick={() => onUpdate({ status: "suspended" })}
              >
                Suspend
              </Button>
            )}
            <Button size="sm" variant="ghost" disabled={protectedMember} onClick={onRemove}>
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
