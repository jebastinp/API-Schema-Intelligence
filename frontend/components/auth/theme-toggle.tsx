"use client";

import { ChevronDown, SunMedium } from "lucide-react";
import { useEffect, useState } from "react";

export function AuthThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const nextTheme = document.documentElement.classList.contains("dark") ? "dark" : "light";
    setTheme(nextTheme);
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "light" ? "dark" : "light";
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    window.localStorage.setItem("schema-studio-theme", nextTheme);
    setTheme(nextTheme);
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-[14px] font-medium text-[#0A66FF] transition hover:bg-white/70"
    >
      <SunMedium className="h-4 w-4" />
      <span>{theme === "light" ? "Light Mode" : "Dark Mode"}</span>
      <ChevronDown className="h-4 w-4" />
    </button>
  );
}
