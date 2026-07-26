import { forwardRef } from "react";

import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex h-10 w-full rounded-[12px] border border-[#E2E8F0] bg-white px-3.5 text-[14px] text-[#0F172A] shadow-sm outline-none transition focus:border-[#93C5FD] focus:ring-4 focus:ring-[#DBEAFE]",
      className,
    )}
    {...props}
  />
));

Input.displayName = "Input";
