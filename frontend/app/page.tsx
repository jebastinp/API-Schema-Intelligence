export default async function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-6">
      <div className="w-full max-w-md rounded-[24px] border border-[#E5E7EB] bg-white p-8 text-center shadow-[0_20px_60px_-40px_rgba(15,23,42,0.22)]">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#2563EB]">Schema Studio</p>
        <h1 className="mt-4 text-3xl font-semibold text-[#0F172A]">Sign in to continue</h1>
        <p className="mt-3 text-sm leading-6 text-[#64748B]">
          Open the authentication page to access your API schema workspace.
        </p>
        <a
          href="/login"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-[14px] bg-[#2563EB] px-5 text-sm font-medium text-white transition hover:bg-[#1D4ED8]"
        >
          Open Login
        </a>
      </div>
    </main>
  );
}
