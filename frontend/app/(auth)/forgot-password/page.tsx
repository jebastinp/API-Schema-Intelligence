import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset password"
      subtitle="Request a secure recovery link for your account."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
