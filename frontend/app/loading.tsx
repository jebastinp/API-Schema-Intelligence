export default function RootLoading() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.16),_transparent_44%),linear-gradient(180deg,#f8fafc_0%,#eef4ff_100%)] px-6"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="rounded-[2rem] border border-white/70 bg-white/78 px-8 py-7 text-center shadow-[0_32px_120px_-60px_rgba(15,23,42,0.35)] backdrop-blur-xl">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-blue-100 border-t-blue-500" />
        <p className="mt-4 text-sm font-medium text-slate-700">Loading Schema Studio…</p>
      </div>
    </div>
  );
}
