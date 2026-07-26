import { forwardRef } from "react";

import { cn } from "@/lib/utils";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "flex h-10 w-full rounded-[12px] border border-[#E2E8F0] bg-white px-3.5 text-[14px] text-[#0F172A] shadow-sm outline-none transition focus:border-[#93C5FD] focus:ring-4 focus:ring-[#DBEAFE]",
      className,
    )}
    {...props}
  />
));

Select.displayName = "Select";
