import { AlertTriangle, Inbox, Lock, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center rounded-lg border border-dashed border-border bg-white/60 py-16 text-sm text-muted-foreground">
      {label}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
}: {
  title: string;
  description?: string;
  icon?: typeof Inbox;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-white/60 py-16 text-center">
      <Icon className="mb-3 h-6 w-6 text-muted-foreground" />
      <div className="text-sm font-medium text-foreground">{title}</div>
      {description && (
        <div className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</div>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-rose-200 bg-rose-50/50 py-12 text-center">
      <AlertTriangle className="mb-2 h-5 w-5 text-rose-600" />
      <div className="text-sm font-medium text-rose-900">Something went wrong</div>
      <div className="mt-1 text-xs text-rose-700">We couldn't load this data.</div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 inline-flex items-center gap-1 rounded-md border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-800 hover:bg-rose-100"
        >
          <RefreshCw className="h-3 w-3" /> Try again
        </button>
      )}
    </div>
  );
}

export function PermissionDeniedState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-white/60 py-12 text-center">
      <Lock className="mb-2 h-5 w-5 text-muted-foreground" />
      <div className="text-sm font-medium">You don't have access to this page</div>
      <div className="mt-1 max-w-sm text-xs text-muted-foreground">
        Ask an Owner or Admin on your institution's workspace to grant you access.
      </div>
    </div>
  );
}

export function ServiceUnavailableState({
  title = "This workspace feature is unavailable",
  description = "Institution backend access has not been connected yet. Kairo will enable this flow once the approved API contract is available.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-amber-200 bg-amber-50/60 py-12 text-center">
      <AlertTriangle className="mb-2 h-5 w-5 text-amber-700" />
      <div className="text-sm font-medium text-amber-950">{title}</div>
      <div className="mt-1 max-w-md text-xs text-amber-900/80">{description}</div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ConfigurationErrorState({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-lg rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm">
        <AlertTriangle className="mx-auto h-6 w-6 text-rose-600" />
        <h1 className="mt-3 text-lg font-semibold text-foreground">
          Institution Workspace configuration error
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
