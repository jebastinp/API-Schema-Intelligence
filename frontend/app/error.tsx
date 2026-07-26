"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.14),_transparent_40%),linear-gradient(180deg,#f8fafc_0%,#eef4ff_100%)] px-6">
      <div
        role="alert"
        className="max-w-xl rounded-[2rem] border border-rose-200 bg-white/88 p-8 shadow-[0_32px_120px_-60px_rgba(15,23,42,0.35)] backdrop-blur-xl"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.22em] text-rose-600">
          Application Error
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
          Schema Studio hit an unexpected error.
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {error.message || "An unknown error occurred while rendering the application."}
        </p>
        <div className="mt-6">
          <Button onClick={reset} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>
    </div>
  );
}
