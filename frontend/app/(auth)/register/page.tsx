import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";
import { redirectIfAuthenticated } from "@/lib/auth";

export default async function RegisterPage() {
  await redirectIfAuthenticated();

  return (
    <AuthShell
      title="Create your account"
      subtitle="Create an account to begin using Schema Studio."
    >
      <RegisterForm />
    </AuthShell>
  );
}
