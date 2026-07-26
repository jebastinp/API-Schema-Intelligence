"use client";

import { Eye, EyeOff } from "lucide-react";
import { forwardRef, useState } from "react";

import { cn } from "@/lib/utils";

type AuthInputFieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  icon: React.ReactNode;
  error?: string;
};

export const AuthInputField = forwardRef<HTMLInputElement, AuthInputFieldProps>(
  ({ className, label, icon, error, type, ...props }, ref) => {
    const isPassword = type === "password";
    const [visible, setVisible] = useState(false);
    const resolvedType = isPassword ? (visible ? "text" : "password") : type;

    return (
      <label className="block">
        <span className="mb-3 block text-[14px] font-medium text-[#334155]">{label}</span>
        <div
          className={cn(
            "group flex h-[54px] items-center rounded-2xl border border-[#D9E1EC] bg-white px-4 shadow-[0_14px_30px_-28px_rgba(15,23,42,0.18)] transition focus-within:border-[#BFD2FF] focus-within:ring-4 focus-within:ring-[#EAF2FF]",
            error ? "border-red-300 focus-within:ring-red-100" : "",
          )}
        >
          <span className="mr-3 text-[#0A66FF]">{icon}</span>
          <input
            ref={ref}
            type={resolvedType}
            className={cn(
              "h-full w-full border-0 bg-transparent text-[16px] text-[#0F172A] outline-none placeholder:text-[#94A3B8]",
              className,
            )}
            {...props}
          />
          {isPassword ? (
            <button
              type="button"
              onClick={() => setVisible((current) => !current)}
              className="ml-3 text-[#64748B] transition hover:text-[#0F172A]"
              aria-label={visible ? "Hide password" : "Show password"}
            >
              {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          ) : null}
        </div>
        {error ? <span className="mt-2 block text-[13px] text-[#DC2626]">{error}</span> : null}
      </label>
    );
  },
);

AuthInputField.displayName = "AuthInputField";
