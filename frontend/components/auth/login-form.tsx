"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, Mail } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { AuthInputField } from "@/components/auth/auth-input-field";
import { Button } from "@/components/ui/button";
import { hasPublicSupabaseEnv } from "@/lib/env";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  remember: z.boolean().default(true),
});

type LoginValues = z.input<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const supabaseConfigured = hasPublicSupabaseEnv();

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      remember: true as boolean | undefined,
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setPending(true);
    setError(null);

    if (!supabaseConfigured) {
      setPending(false);
      setError("Sign-in is currently unavailable. Check local configuration and try again.");
      return;
    }

    const supabase = createSupabaseBrowserClient();

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    setPending(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    router.push("/dashboard" as Route);
    router.refresh();
  });

  return (
    <div className="w-full">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[linear-gradient(180deg,#EEF6FF_0%,#E8F2FF_100%)] text-[#007AFF] shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
        <Lock className="h-6 w-6 fill-[#007AFF] stroke-white stroke-[1.8]" />
      </div>

      <div className="mt-5 text-center">
        <h2 className="text-[28px] font-bold tracking-[-0.04em] text-[#0F172A] sm:text-[30px]">Welcome Back</h2>
        <p className="mt-2 text-[15px] text-[#64748B]">Sign in to continue to Schema Studio.</p>
      </div>

      <form className="mt-7 space-y-5" onSubmit={onSubmit}>
        <AuthInputField
          label="Email address"
          type="email"
          icon={<Mail className="h-5 w-5" />}
          placeholder="you@example.com"
          autoComplete="email"
          error={form.formState.errors.email?.message}
          {...form.register("email")}
        />
        <AuthInputField
          label="Password"
          type="password"
          icon={<Lock className="h-5 w-5" />}
          placeholder="Enter your password"
          autoComplete="current-password"
          error={form.formState.errors.password?.message}
          {...form.register("password")}
        />

        <div className="flex flex-col gap-2 text-[14px] text-[#0F172A] sm:flex-row sm:items-center sm:justify-between">
          <label className="inline-flex items-center gap-3">
            <input
              type="checkbox"
              className="h-[18px] w-[18px] rounded-[5px] border-[#BFD2FF] bg-[#0A66FF] text-[#0A66FF] accent-[#0A66FF]"
              {...form.register("remember")}
            />
            <span className="text-[14px] text-[#0F172A]">Remember me</span>
          </label>
          <Link href={"/forgot-password" as Route} className="font-medium text-[#0A66FF] transition hover:text-[#0958DA]">
            Forgot password?
          </Link>
        </div>

        {error ? <p className="text-[14px] text-[#DC2626]">{error}</p> : null}

        <Button
          className="h-[52px] w-full rounded-[16px] bg-[linear-gradient(90deg,#007AFF_0%,#1D8CFF_100%)] text-[16px] font-semibold text-white shadow-[0_18px_34px_-22px_rgba(0,122,255,0.5)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_38px_-22px_rgba(0,122,255,0.55)]"
          type="submit"
          disabled={pending}
        >
          {pending ? "Signing in..." : "Sign In"}
        </Button>

        <p className="text-center text-[14px] text-[#475569]">
          Don&apos;t have an account?{" "}
          <Link href={"/register" as Route} className="font-medium text-[#0A66FF] transition hover:text-[#0958DA]">
            Create account
          </Link>
        </p>
      </form>
    </div>
  );
}
