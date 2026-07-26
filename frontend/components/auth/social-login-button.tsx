"use client";

import { motion } from "framer-motion";

type SocialLoginButtonProps = {
  onClick: () => void;
  disabled?: boolean;
};

export function SocialLoginButton({ onClick, disabled }: SocialLoginButtonProps) {
  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.995 }}
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-[54px] w-full items-center justify-center gap-3 rounded-2xl border border-[#D9E1EC] bg-white text-[15px] font-medium text-[#0F172A] shadow-[0_14px_30px_-28px_rgba(15,23,42,0.18)] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.225 36 24 36c-6.627 0-12-5.373-12-12S17.373 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.277 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
        <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.277 4 24 4c-7.682 0-14.334 4.337-17.694 10.691z" />
        <path fill="#4CAF50" d="M24 44c5.176 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.142 35.091 26.715 36 24 36c-5.204 0-9.618-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
        <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.084 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
      </svg>
      <span>Sign in with Google</span>
    </motion.button>
  );
}
