import type { ReactNode } from "react";

export function FormField({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[13px] font-medium text-[#334155]">{label}</span>
      {children}
      {error ? (
        <span className="text-[13px] text-danger">{error}</span>
      ) : hint ? (
        <span className="text-[13px] text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

export function DividerLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.22em] text-muted">
      <span className="h-px flex-1 bg-border" />
      <span>{children}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
