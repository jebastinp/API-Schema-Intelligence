import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function WorkspaceSection({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card
      className={cn(
        "grid min-h-0 grid-rows-[auto_minmax(0,1fr)] rounded-[16px] border border-[#E2E8F0] bg-white p-5 transition hover:border-[#DBEAFE] hover:shadow-[0_16px_32px_-24px_rgba(37,99,235,0.24)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-[20px] font-semibold tracking-[-0.03em] text-[#0F172A]">{title}</h3>
          {description ? <p className="mt-1 text-[13px] text-[#64748B]">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className={cn("mt-4 min-h-0", contentClassName)}>{children}</div>
    </Card>
  );
}
