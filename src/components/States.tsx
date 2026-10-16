import { Component, type ReactNode } from "react";
import { ApiError } from "../api/client";
import { copy } from "../copy";
import { AlertIcon } from "./icons";

export function Loading({ label = copy.errors.loading, className = "" }: { label?: string; className?: string }) {
  return (
    <div role="status" className={`flex items-center justify-center gap-2 p-6 text-sm text-slate-500 ${className}`}>
      <span className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
      {label}
    </div>
  );
}

export function ErrorState({ error, onRetry, className = "" }: { error: unknown; onRetry?: () => void; className?: string }) {
  const message = error instanceof ApiError && error.status === 0 ? "เชื่อมต่อไม่ได้" : copy.errors.generic;
  return (
    <div role="alert" className={`flex flex-col items-center gap-3 p-6 text-center text-sm text-slate-600 ${className}`}>
      <AlertIcon className="text-2xl text-amber-600" />
      <p>{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
        >
          {copy.errors.retry}
        </button>
      )}
    </div>
  );
}

export function EmptyState({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`p-8 text-center text-sm text-slate-500 ${className}`}>{children}</div>;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <AlertIcon className="text-3xl text-amber-600" />
        <p className="font-semibold">{copy.errors.pageCrashed}</p>
        <p className="text-sm text-slate-600">เหตุฉุกเฉินโทร 1784</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg bg-brand-700 px-4 py-2 font-semibold text-white"
        >
          {copy.errors.reload}
        </button>
      </div>
    );
  }
}
