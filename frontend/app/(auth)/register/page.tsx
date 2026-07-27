import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  return (
    <AuthShell
      title="Create your account"
      subtitle="Create an account to begin using Schema Studio."
    >
      <RegisterForm />
    </AuthShell>
  );
}
