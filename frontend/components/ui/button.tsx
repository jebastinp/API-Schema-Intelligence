import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-[12px] text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DBEAFE] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-[#2563EB] text-white shadow-[0_10px_20px_-14px_rgba(37,99,235,0.55)] hover:bg-[#1D4ED8]",
        secondary:
          "bg-white text-[#0F172A] ring-1 ring-[#E2E8F0] hover:bg-[#F8FAFC]",
        ghost: "bg-transparent text-[#0F172A] hover:bg-[#F1F5F9]",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 px-3.5",
        lg: "h-11 px-5",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);

Button.displayName = "Button";
