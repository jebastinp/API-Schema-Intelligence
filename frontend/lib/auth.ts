import type { Route } from "next";
import { redirect } from "next/navigation";

import { hasPublicSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function getCurrentSession() {
  if (!hasPublicSupabaseEnv()) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session;
}

export async function requireUser() {
  const session = await getCurrentSession();

  if (!session?.user) {
    redirect("/login" as Route);
  }

  return session.user;
}

export async function redirectIfAuthenticated() {
  const session = await getCurrentSession();

  if (session?.user) {
    redirect("/dashboard" as Route);
  }
}
