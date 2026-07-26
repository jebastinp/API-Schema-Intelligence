import type { Route } from "next";
import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth";

export default async function HomePage() {
  const session = await getCurrentSession();

  redirect((session?.user ? "/dashboard" : "/login") as Route);
}
