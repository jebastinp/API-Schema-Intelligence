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

const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address."),
});

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const supabaseConfigured = hasPublicSupabaseEnv();
  const supabase = supabaseConfigured ? createSupabaseBrowserClient() : null;

  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setPending(true);
    setError(null);
    setSuccess(null);

    if (!supabase) {
      setPending(false);
      setError("Password recovery is currently unavailable. Check local configuration and try again.");
      return;
    }

    const redirectTo =
      typeof window === "undefined" ? undefined : `${window.location.origin}/reset-password`;

    const { error: authError } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo,
    });

    setPending(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    setSuccess("A password reset link has been sent if the account exists.");
    form.reset();
  });

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <FormField
        label="Email"
        error={form.formState.errors.email?.message}
        hint="A recovery link will be sent if the account exists."
      >
        <Input type="email" autoComplete="email" {...form.register("email")} />
      </FormField>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {success ? <p className="text-sm text-success">{success}</p> : null}
      <Button className="w-full" type="submit" disabled={pending}>
        {pending ? "Sending..." : "Send Reset Link"}
      </Button>
      <Link href={"/login" as Route} className="block text-center text-sm font-medium text-primary">
        Back to sign in
      </Link>
    </form>
  );
}
