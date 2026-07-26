import { forwardRef } from "react";

import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[120px] w-full rounded-[12px] border border-[#E2E8F0] bg-white px-3.5 py-3 text-[14px] text-[#0F172A] shadow-sm outline-none transition focus:border-[#93C5FD] focus:ring-4 focus:ring-[#DBEAFE]",
        className,
      )}
      {...props}
    />
  ),
);

Textarea.displayName = "Textarea";
