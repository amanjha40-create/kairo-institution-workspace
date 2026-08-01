import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Bell, Menu, X, LogOut, ShieldCheck, Users, UserCog, Settings } from "lucide-react";
import { KairoLogo } from "./Logo";
import {
  getInstitutionNotifications,
  markAllInstitutionNotificationsRead,
  markInstitutionNotificationRead,
} from "@/lib/institution/api";
import { useInstitutionAuth } from "@/lib/institution/auth";
import {
  getInstitutionModeLabel,
  institutionDemoModeEnabled,
  institutionAppConfig,
} from "@/lib/institution/config";
import { formatDateTime } from "@/lib/institution/format";
import { institutionQueryKeys } from "@/lib/institution/query-keys";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/institution/verifications", label: "Verification Requests", Icon: ShieldCheck },
  { to: "/institution/people", label: "People", Icon: Users },
  { to: "/institution/team", label: "Team", Icon: UserCog },
  { to: "/institution/settings", label: "Settings", Icon: Settings },
] as const;

const roleLabels: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  reviewer: "Reviewer",
  member: "Member",
};

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const { session, signOut } = useInstitutionAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const notificationsQuery = useQuery({
    queryKey: institutionQueryKeys.notifications(),
    queryFn: getInstitutionNotifications,
    enabled: Boolean(session),
    staleTime: 30_000,
  });

  const markReadMutation = useMutation({
    mutationFn: markInstitutionNotificationRead,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: institutionQueryKeys.notifications() });
      await queryClient.invalidateQueries({
        queryKey: institutionQueryKeys.notificationUnreadCount,
      });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: markAllInstitutionNotificationsRead,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: institutionQueryKeys.notifications() });
      await queryClient.invalidateQueries({
        queryKey: institutionQueryKeys.notificationUnreadCount,
      });
    },
  });

  const handleSignOut = () => {
    void signOut().finally(() => {
      navigate({ to: "/institution/login" });
    });
  };

  const isActive = (to: string) => location.pathname.startsWith(to);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link to="/institution" className="flex shrink-0 items-center gap-2">
            <KairoLogo className="h-7 w-auto" />
          </Link>
          <div className="hidden min-w-0 items-center gap-2 md:flex">
            <span className="h-4 w-px bg-border" />
            <span className="truncate text-sm font-medium text-foreground">
              {session?.institutionName ?? "Institution"}
            </span>
            <span className="rounded-full bg-[color:var(--kairo-teal-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--kairo-navy-deep)]">
              Trust Workspace
            </span>
            {institutionDemoModeEnabled && institutionAppConfig.demoMode && (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
                {getInstitutionModeLabel()}
              </span>
            )}
          </div>
          <nav className="ml-6 hidden flex-1 items-center gap-1 md:flex">
            {NAV.map(({ to, label, Icon }) => (
              <Link
                key={to}
                to={to}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                  isActive(to) &&
                    "bg-[color:var(--kairo-teal-soft)] text-[color:var(--kairo-navy-deep)]",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative hidden md:block">
              <button
                onClick={() => setNotificationsOpen((value) => !value)}
                className="relative rounded-md border border-border bg-white p-2 hover:bg-secondary"
                aria-label="Open notifications"
              >
                <Bell className="h-4 w-4" />
                {notificationsQuery.data && notificationsQuery.data.unreadCount > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white">
                    {notificationsQuery.data.unreadCount}
                  </span>
                ) : null}
              </button>
              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 rounded-md border border-border bg-white p-1 shadow-lg">
                  <div className="flex items-center justify-between px-3 py-2">
                    <div className="text-sm font-medium">Notifications</div>
                    <button
                      type="button"
                      className="text-xs text-[color:var(--kairo-navy)] hover:underline disabled:text-muted-foreground"
                      disabled={
                        markAllReadMutation.isPending ||
                        !notificationsQuery.data ||
                        notificationsQuery.data.unreadCount === 0
                      }
                      onClick={() => markAllReadMutation.mutate()}
                    >
                      Mark all read
                    </button>
                  </div>
                  {notificationsQuery.isLoading ? (
                    <div className="px-3 py-4 text-xs text-muted-foreground">Loading…</div>
                  ) : notificationsQuery.isError ? (
                    <div className="px-3 py-4 text-xs text-muted-foreground">
                      Notifications are unavailable right now.
                    </div>
                  ) : !notificationsQuery.data || notificationsQuery.data.items.length === 0 ? (
                    <div className="px-3 py-4 text-xs text-muted-foreground">
                      No notifications yet.
                    </div>
                  ) : (
                    <ul className="max-h-96 overflow-y-auto">
                      {notificationsQuery.data.items.map((notification) => (
                        <li
                          key={notification.id}
                          className="border-t border-border px-3 py-3 first:border-t-0"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-medium">{notification.title}</div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {notification.body}
                              </div>
                              <div className="mt-1 text-[11px] text-muted-foreground">
                                {formatDateTime(notification.createdAt)}
                              </div>
                            </div>
                            {!notification.readAt ? (
                              <button
                                type="button"
                                className="shrink-0 text-[11px] text-[color:var(--kairo-navy)] hover:underline"
                                disabled={markReadMutation.isPending}
                                onClick={() => markReadMutation.mutate(notification.id)}
                              >
                                Mark read
                              </button>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            <div className="relative hidden md:block">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-md border border-border bg-white px-2 py-1.5 text-left text-sm hover:bg-secondary"
              >
                <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {session?.name?.slice(0, 1) ?? "U"}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium leading-tight">
                    {session?.name}
                  </span>
                  <span className="block truncate text-[10px] leading-tight text-muted-foreground">
                    {session ? roleLabels[session.role] : ""}
                  </span>
                </span>
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-md border border-border bg-white p-1 shadow-lg">
                  <div className="px-3 py-2 text-xs text-muted-foreground">{session?.email}</div>
                  <button
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-secondary"
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </div>
              )}
            </div>
            <button
              className="rounded-md border border-border p-2 md:hidden"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle navigation"
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {mobileOpen && (
          <div className="border-t border-border bg-white md:hidden">
            <div className="mx-auto max-w-7xl px-4 py-3">
              <div className="mb-3 text-xs text-muted-foreground">{session?.institutionName}</div>
              <nav className="flex flex-col gap-1">
                {NAV.map(({ to, label, Icon }) => (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground",
                      isActive(to) &&
                        "bg-[color:var(--kairo-teal-soft)] text-[color:var(--kairo-navy-deep)]",
                    )}
                  >
                    <Icon className="h-4 w-4" /> {label}
                  </Link>
                ))}
              </nav>
              <div className="mt-3 border-t border-border pt-3">
                <div className="text-sm font-medium">{session?.name}</div>
                <div className="text-xs text-muted-foreground">
                  {session ? roleLabels[session.role] : ""} · {session?.email}
                </div>
                <button
                  onClick={handleSignOut}
                  className="mt-2 inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </div>
            </div>
          </div>
        )}
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
