import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { redirectIfAuthenticated } from "@/lib/auth";

export default async function LoginPage() {
  await redirectIfAuthenticated();

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to continue into Schema Studio."
      showCardHeader={false}
    >
      <LoginForm />
    </AuthShell>
  );
}
