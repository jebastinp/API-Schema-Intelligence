"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { hasPublicSupabaseEnv } from "@/lib/env";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

const resetPasswordSchema = z
  .object({
    password: z.string().min(12, "Use at least 12 characters."),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords must match.",
  });

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const supabaseConfigured = hasPublicSupabaseEnv();
  const supabase = supabaseConfigured ? createSupabaseBrowserClient() : null;

  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setPending(true);
    setError(null);

    if (!supabase) {
      setPending(false);
      setError("Password reset is currently unavailable. Check local configuration and try again.");
      return;
    }

    const { error: authError } = await supabase.auth.updateUser({
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
    <form className="space-y-5" onSubmit={onSubmit}>
      <FormField
        label="New Password"
        error={form.formState.errors.password?.message}
        hint="Choose a new password for your account."
      >
        <Input type="password" autoComplete="new-password" {...form.register("password")} />
      </FormField>
      <FormField label="Confirm Password" error={form.formState.errors.confirmPassword?.message}>
        <Input type="password" autoComplete="new-password" {...form.register("confirmPassword")} />
      </FormField>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <Button className="w-full" type="submit" disabled={pending}>
        {pending ? "Updating..." : "Update Password"}
      </Button>
      <Link href={"/login" as Route} className="block text-center text-sm font-medium text-primary">
        Back to sign in
      </Link>
    </form>
  );
}
