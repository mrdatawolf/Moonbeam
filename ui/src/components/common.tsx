// Small shared pieces: timestamps, task references, empty and loading states,
// refusal messages, and form fields. One component per job (Paperclip
// DESIGN.md principle 1).
import { useId, type ReactNode, type Ref } from "react";
import { Link } from "react-router";
import { ApiRequestError } from "../api/client";
import { absoluteTime, CATEGORY_LABEL, relativeTime } from "../lib/format";

/** Relative time, with the absolute local time on hover, focus and for screen readers (SV-5). */
export function Time({ iso }: { iso: string }) {
  const abs = absoluteTime(iso);
  return (
    <time dateTime={iso} title={abs} className="font-mono text-xs" tabIndex={0}>
      <span aria-hidden>{relativeTime(iso)}</span>
      <span className="sr-only">{abs}</span>
    </time>
  );
}

export function TaskRef({ id, number, title }: { id: string; number: number; title?: string }) {
  return (
    <Link to={`/tasks/${id}`} className="underline-offset-2 hover:underline">
      <span className="font-mono text-muted-foreground">#{number}</span>
      {title ? <span className="ml-1.5">{title}</span> : null}
    </Link>
  );
}

export function Mono({ children }: { children: ReactNode }) {
  return <span className="font-mono text-xs break-all">{children}</span>;
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-border px-4 py-5 text-sm">
      <p className="font-medium">{title}</p>
      {children ? <div className="mt-1 text-muted-foreground">{children}</div> : null}
    </div>
  );
}

/** Loading skeleton of the page layout; never a spinner-only page (CONTRACT-003). */
export function Skeleton({ lines = 4, label = "Loading" }: { lines?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">{label}…</span>
      <div className="h-7 w-1/2 animate-pulse rounded-control bg-muted" />
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="h-4 animate-pulse rounded-control bg-muted" style={{ width: `${90 - i * 12}%` }} />
      ))}
    </div>
  );
}

/** A failed read: not found gets its own sentence and a way back; other errors say what happened. */
export function LoadError({ error, notFound, back }: { error: unknown; notFound: string; back?: { to: string; label: string } }) {
  const isNotFound = error instanceof ApiRequestError && error.category === "not_found";
  return (
    <div role="alert" className="card p-5">
      <p className="font-medium">{isNotFound ? notFound : "This page could not be loaded."}</p>
      {!isNotFound && error instanceof Error ? <p className="mt-1 text-sm text-muted-foreground">{error.message}</p> : null}
      {back ? (
        <Link to={back.to} className="mt-3 inline-block text-sm text-primary underline">
          {back.label}
        </Link>
      ) : null}
    </div>
  );
}

function detailLines(details: unknown): string[] {
  if (!details || typeof details !== "object") return [];
  const d = details as Record<string, unknown>;
  const out: string[] = [];
  if (Array.isArray(d.issues)) out.push(...d.issues.map(String));
  if (Array.isArray(d.unfinishedDependencies)) {
    for (const dep of d.unfinishedDependencies as Record<string, unknown>[]) {
      out.push(`Waiting for #${String(dep.number ?? "?")} ${String(dep.title ?? "")} (${String(dep.kind ?? "dependency")})`.trim());
    }
  }
  if (d.claimant && typeof d.claimant === "object") {
    const c = d.claimant as Record<string, unknown>;
    out.push(`Current claimant: ${String(c.displayName ?? c.model ?? c.kind ?? "unknown")}`);
  }
  if (Array.isArray(d.startedTasks)) {
    for (const t of d.startedTasks as Record<string, unknown>[]) {
      out.push(`#${String(t.number)} would wait on ${(t.gained as number[] | undefined)?.map((n) => `#${n}`).join(", ") ?? "an unfinished task"}`);
    }
  }
  if (Array.isArray(d.conflictingFiles)) out.push(`Conflicting files: ${d.conflictingFiles.join(", ")}`);
  if (Array.isArray(d.outOfScopeFiles)) out.push(`Files outside the declared paths: ${d.outOfScopeFiles.join(", ")}`);
  return out;
}

/**
 * A rejected action: the failure category (plain name and code) and the
 * server's reason, next to the action (CONTRACT-003 A). Rendered as an alert
 * so it is announced once.
 */
export function Refusal({ error, id }: { error: unknown; id?: string }) {
  if (!error) return null;
  const e = error instanceof ApiRequestError ? error : new ApiRequestError("unexpected", String((error as Error)?.message ?? error), null);
  const lines = detailLines(e.details);
  return (
    <div id={id} role="alert" className="rounded-control border border-tone-danger-border bg-tone-danger-bg px-3 py-2 text-sm text-tone-danger-fg">
      <p>
        <strong>Refused: {CATEGORY_LABEL[e.category]}</strong> <span className="font-mono text-xs">({e.category})</span>
      </p>
      <p className="mt-0.5">{e.message}</p>
      {e.category === "unidentified" ? <p className="mt-0.5">Choose who you are again, then retry.</p> : null}
      {e.category === "conflict" ? <p className="mt-0.5">The view was refreshed to the current state.</p> : null}
      {lines.length ? (
        <ul className="mt-1 list-disc pl-5">
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

interface FieldProps {
  label: string;
  hint?: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  mono?: boolean;
  autoFocus?: boolean;
  type?: string;
  /** A client-side check that failed; shown under the field and linked to it. */
  error?: string | null;
  autoComplete?: string;
  inputRef?: Ref<HTMLInputElement>;
}

export function Field({ label, hint, required, value, onChange, multiline, rows = 3, placeholder, mono, autoFocus, type = "text", error, autoComplete, inputRef }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  const cls = `field-input ${mono ? "font-mono" : ""}`;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
        {required ? <span className="text-muted-foreground"> (required)</span> : null}
      </label>
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {multiline ? (
        <textarea
          id={id}
          className={cls}
          rows={rows}
          value={value}
          required={required}
          placeholder={placeholder}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          id={id}
          type={type}
          className={cls}
          value={value}
          required={required}
          placeholder={placeholder}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          ref={inputRef}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {error ? (
        <p id={errorId} className="text-xs text-tone-danger-fg">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Split a textarea into one entry per non-empty line. */
export const lines = (s: string) =>
  s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

export function SectionHeading({ id, children, count }: { id: string; children: ReactNode; count?: number }) {
  return (
    <h2 id={id} className="text-base font-semibold">
      {children}
      {count !== undefined ? <span className="ml-1.5 font-mono text-sm font-normal text-muted-foreground">{count}</span> : null}
    </h2>
  );
}
