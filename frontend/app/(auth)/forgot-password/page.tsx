import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { redirectIfAuthenticated } from "@/lib/auth";

export default async function ForgotPasswordPage() {
  await redirectIfAuthenticated();

  return (
    <AuthShell
      title="Reset password"
      subtitle="Request a secure recovery link for your account."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
