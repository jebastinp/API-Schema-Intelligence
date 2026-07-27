import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-6 py-10">
      <div className="w-full max-w-[460px] rounded-[28px] border border-[#E5E7EB] bg-white p-8 shadow-[0_24px_64px_-42px_rgba(15,23,42,0.28)]">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#2563EB]">Schema Studio</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-[#0F172A]">Welcome Back</h1>
          <p className="mt-2 text-sm text-[#64748B]">Sign in to continue to Schema Studio.</p>
        </div>
        <div className="mt-8">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
