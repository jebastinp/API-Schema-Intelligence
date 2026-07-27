import type { Route } from "next";
import { redirect } from "next/navigation";

export default async function HomePage() {
  redirect("/login" as Route);
}
