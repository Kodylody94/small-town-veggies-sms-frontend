import { AlertTriangle, Inbox, LoaderCircle } from 'lucide-react';
import { formatStatus, statusClasses } from '../utils';

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow && (
          <p className="mb-1 text-sm font-bold uppercase tracking-[0.16em] text-emerald-800">
            {eyebrow}
          </p>
        )}
        <h1 className="text-3xl font-black tracking-tight text-emerald-950 md:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-stone-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatusBadge({ status }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusClasses(status)}`}>
      {formatStatus(status)}
    </span>
  );
}

export function LoadingState({ label = 'Loading data' }) {
  return (
    <div className="panel flex min-h-44 items-center justify-center gap-3 text-stone-600" role="status">
      <LoaderCircle className="animate-spin" aria-hidden="true" />
      {label}…
    </div>
  );
}

export function EmptyState({ title = 'Nothing here yet', message }) {
  return (
    <div className="panel flex min-h-44 flex-col items-center justify-center text-center">
      <Inbox className="mb-3 text-stone-400" aria-hidden="true" />
      <h2 className="font-bold text-stone-900">{title}</h2>
      {message && <p className="mt-1 max-w-md text-sm text-stone-600">{message}</p>}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="panel border-red-200 bg-red-50" role="alert">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 shrink-0 text-red-700" aria-hidden="true" />
        <div>
          <h2 className="font-bold text-red-950">Could not load this page</h2>
          <p className="mt-1 text-sm text-red-800">{error?.message || 'An unexpected error occurred.'}</p>
          {onRetry && (
            <button type="button" className="button-secondary mt-4" onClick={onRetry}>
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
