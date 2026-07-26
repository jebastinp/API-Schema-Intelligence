import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Finish the recovery flow by setting a new password for your account."
    >
      <ResetPasswordForm />
    </AuthShell>
  );
}
