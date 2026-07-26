import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748B]">{eyebrow}</p>
        ) : null}
        <h2 className="mt-1 text-[28px] font-semibold tracking-[-0.04em] text-[#0F172A]">{title}</h2>
        {description ? <p className="mt-2 max-w-3xl text-[15px] text-[#64748B]">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
