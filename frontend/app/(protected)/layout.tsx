import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireUser } from "@/lib/auth";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return <DashboardShell email={user.email ?? "unknown-user"}>{children}</DashboardShell>;
}
