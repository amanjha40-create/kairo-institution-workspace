import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Bell } from "lucide-react";
import {
  getInstitutionNotifications,
  markAllInstitutionNotificationsRead,
  markInstitutionNotificationRead,
} from "@/lib/institution/api";
import { useInstitutionAuth } from "@/lib/institution/auth";
import { getInstitutionErrorMessage, isInstitutionError } from "@/lib/institution/errors";
import { formatDateTime } from "@/lib/institution/format";
import { resolveInstitutionNotificationPath } from "@/lib/institution/notifications";
import { institutionQueryKeys } from "@/lib/institution/query-keys";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PaginationState,
  ServiceUnavailableState,
} from "@/components/institution/PageStates";
import { Button } from "@/components/ui/button";

const NOTIFICATIONS_PAGE_SIZE = 20;

export const Route = createFileRoute("/institution/notifications")({
  component: NotificationsPage,
});

function NotificationsPage() {
  const queryClient = useQueryClient();
  const { session } = useInstitutionAuth();
  const [page, setPage] = useState(1);

  const filters = useMemo(
    () => ({
      page,
      pageSize: NOTIFICATIONS_PAGE_SIZE,
    }),
    [page],
  );

  const notificationsQuery = useQuery({
    queryKey: institutionQueryKeys.notifications(filters),
    queryFn: () => getInstitutionNotifications(filters),
    enabled: Boolean(session),
  });

  const markReadMutation = useMutation({
    mutationFn: markInstitutionNotificationRead,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["institution", "notifications"] });
      await queryClient.invalidateQueries({
        queryKey: institutionQueryKeys.notificationUnreadCount,
      });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: markAllInstitutionNotificationsRead,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["institution", "notifications"] });
      await queryClient.invalidateQueries({
        queryKey: institutionQueryKeys.notificationUnreadCount,
      });
    },
  });

  const data = notificationsQuery.data;
  const totalPages = Math.max(data?.totalPages ?? 0, 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review your institution workspace notifications and open linked verification records
            when target metadata is available.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={
            markAllReadMutation.isPending ||
            !data ||
            data.unreadCount === 0 ||
            notificationsQuery.isLoading
          }
          onClick={() => markAllReadMutation.mutate()}
        >
          Mark all read
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Unread</div>
        <div className="mt-1 text-2xl font-semibold text-foreground">
          {data?.unreadCount ?? "—"}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Unread count is backend-driven. Dedicated unread-only filtering is not yet available from
          the shared notification contract.
        </p>
      </div>

      {notificationsQuery.isLoading ? (
        <LoadingState />
      ) : notificationsQuery.isError &&
        isInstitutionError(notificationsQuery.error) &&
        notificationsQuery.error.status === 503 ? (
        <ServiceUnavailableState
          title="Notifications are unavailable"
          description={getInstitutionErrorMessage(notificationsQuery.error)}
        />
      ) : notificationsQuery.isError ? (
        <ErrorState onRetry={() => void notificationsQuery.refetch()} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications yet"
          description="Notification delivery is connected, but there are no institution workspace notifications to show right now."
        />
      ) : (
        <>
          <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>
              Showing {(data.offset || 0) + 1}-
              {Math.min((data.offset || 0) + data.items.length, data.total)} of {data.total}{" "}
              notifications
            </span>
            <span>
              Page {data.page} of {totalPages}
            </span>
          </div>

          <ul className="overflow-hidden rounded-lg border border-border bg-white">
            {data.items.map((notification) => {
              const destination = resolveInstitutionNotificationPath(notification.metadata);
              const content = (
                <div className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-medium text-foreground">{notification.title}</h2>
                      {!notification.readAt ? (
                        <span className="rounded-full bg-[color:var(--kairo-teal-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--kairo-navy-deep)]">
                          Unread
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{notification.body}</p>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {formatDateTime(notification.createdAt)}
                    </div>
                    {!destination ? (
                      <div className="mt-2 text-xs text-muted-foreground">
                        No institution route target is available for this notification yet.
                      </div>
                    ) : null}
                  </div>
                  {!notification.readAt ? (
                    <button
                      type="button"
                      className="shrink-0 text-xs text-[color:var(--kairo-navy)] hover:underline"
                      disabled={markReadMutation.isPending}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        markReadMutation.mutate(notification.id);
                      }}
                    >
                      Mark read
                    </button>
                  ) : null}
                </div>
              );

              return (
                <li key={notification.id} className="border-t border-border first:border-t-0">
                  {destination ? (
                    <a href={destination} className="block hover:bg-secondary/50">
                      {content}
                    </a>
                  ) : (
                    content
                  )}
                </li>
              );
            })}
          </ul>

          <PaginationState
            page={data.page}
            totalPages={totalPages}
            pageSize={data.pageSize}
            total={data.total}
            itemLabel="notifications"
            onPrevious={() => setPage((current) => Math.max(1, current - 1))}
            onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
            previousDisabled={data.page <= 1 || notificationsQuery.isFetching}
            nextDisabled={data.page >= totalPages || notificationsQuery.isFetching}
          />
        </>
      )}
    </div>
  );
}
