"use client";

import Link from "next/link";
import type { Route } from "next";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { hasPublicSupabaseEnv } from "@/lib/env";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

const registerSchema = z
  .object({
    fullName: z.string().min(2, "Full name is required."),
    email: z.string().email("Enter a valid email address."),
    password: z.string().min(12, "Use at least 12 characters."),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords must match.",
  });

type RegisterValues = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const supabaseConfigured = hasPublicSupabaseEnv();
  const supabase = supabaseConfigured ? createSupabaseBrowserClient() : null;

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setPending(true);
    setError(null);
    setSuccess(null);

    if (!supabase) {
      setPending(false);
      setError("Account creation is currently unavailable. Check local configuration and try again.");
      return;
    }

    const emailRedirectTo =
      typeof window === "undefined" ? undefined : `${window.location.origin}/account`;

    const { error: authError } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo,
        data: {
          full_name: values.fullName,
        },
      },
    });

    setPending(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    setSuccess("Registration submitted. Check your inbox if email confirmation is enabled.");
    form.reset();
  });

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <FormField label="Full Name" error={form.formState.errors.fullName?.message}>
        <Input autoComplete="name" {...form.register("fullName")} />
      </FormField>
      <FormField label="Email" error={form.formState.errors.email?.message}>
        <Input type="email" autoComplete="email" {...form.register("email")} />
      </FormField>
      <FormField
        label="Password"
        error={form.formState.errors.password?.message}
        hint="Use a strong password with at least 12 characters."
      >
        <Input type="password" autoComplete="new-password" {...form.register("password")} />
      </FormField>
      <FormField label="Confirm Password" error={form.formState.errors.confirmPassword?.message}>
        <Input type="password" autoComplete="new-password" {...form.register("confirmPassword")} />
      </FormField>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {success ? <p className="text-sm text-success">{success}</p> : null}
      <Button className="w-full" type="submit" disabled={pending}>
        {pending ? "Creating account..." : "Create Account"}
      </Button>
      <div className="flex items-center justify-between text-sm text-muted">
        <span>Already have access?</span>
        <Link href={"/login" as Route} className="font-medium text-primary">
          Sign in
        </Link>
      </div>
    </form>
  );
}
