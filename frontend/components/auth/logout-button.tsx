"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { hasPublicSupabaseEnv } from "@/lib/env";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const supabaseConfigured = hasPublicSupabaseEnv();
  const supabase = supabaseConfigured ? createSupabaseBrowserClient() : null;

  async function handleLogout() {
    setPending(true);

    if (supabase) {
      await supabase.auth.signOut();
    }

    router.push("/login" as Route);
    router.refresh();
    setPending(false);
  }

  return (
    <Button onClick={handleLogout} disabled={pending} variant="secondary">
      {pending ? "Signing out..." : "Sign Out"}
    </Button>
  );
}
