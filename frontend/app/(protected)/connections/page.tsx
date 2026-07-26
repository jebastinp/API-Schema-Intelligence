import { ConnectionManager } from "@/components/connections/connection-manager";
import { requireUser } from "@/lib/auth";

export default async function ConnectionsPage() {
  await requireUser();

  return <ConnectionManager />;
}
