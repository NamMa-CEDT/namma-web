import { Component, type ReactNode } from "react";
import { ApiError } from "../api/client";
import { copy, DDPM } from "../copy";
import { AlertIcon } from "./icons";

export function Loading({ label = copy.errors.loading, className = "" }: { label?: string; className?: string }) {
  return (
    <div role="status" className={`flex items-center justify-center gap-2 p-6 text-caption text-ink-muted ${className}`}>
      <span className="size-4 animate-spin rounded-full border-2 border-line border-t-river motion-reduce:animate-none" />
      {label}
    </div>
  );
}

export function ErrorState({ error, onRetry, className = "" }: { error: unknown; onRetry?: () => void; className?: string }) {
  const message = error instanceof ApiError && error.status === 0 ? "เชื่อมต่อไม่ได้" : copy.errors.generic;
  return (
    <div role="alert" className={`flex flex-col items-center gap-3 p-6 text-center text-body text-ink ${className}`}>
      <AlertIcon className="text-[24px] text-ink-muted" />
      <p className="m-0">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="nm-btn nm-btn--secondary nm-btn--sm">
          {copy.errors.retry}
        </button>
      )}
    </div>
  );
}

export function EmptyState({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`p-8 text-center text-body text-ink-muted ${className}`}>{children}</div>;
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
        <AlertIcon className="text-[28px] text-ink-muted" />
        <p className="m-0 text-heading font-semibold">{copy.errors.pageCrashed}</p>
        <p className="m-0 text-body">
          เหตุฉุกเฉินโทร{" "}
          <a href={DDPM.telHref} className="font-semibold text-tier-danger-ink underline">
            {DDPM.hotline}
          </a>
        </p>
        <button type="button" onClick={() => window.location.reload()} className="nm-btn nm-btn--primary">
          {copy.errors.reload}
        </button>
      </div>
    );
  }
}
