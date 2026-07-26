"use client";

import { MoonStar, SunMedium } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

type Theme = "light" | "dark";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const storedTheme = localStorage.getItem("schema-studio-theme");
    const currentTheme =
      storedTheme === "dark" || storedTheme === "light"
        ? storedTheme
        : root.classList.contains("dark")
          ? "dark"
          : "light";
    root.classList.toggle("dark", currentTheme === "dark");
    setTheme(currentTheme);
    setMounted(true);
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    const root = document.documentElement;

    root.classList.toggle("dark", nextTheme === "dark");
    localStorage.setItem("schema-studio-theme", nextTheme);
    setTheme(nextTheme);
  }

  return (
    <Button
      type="button"
      variant="secondary"
      className="gap-2"
      onClick={toggleTheme}
      aria-label="Toggle color theme"
    >
      {mounted && theme === "dark" ? (
        <>
          <SunMedium className="h-4 w-4" />
          Light
        </>
      ) : (
        <>
          <MoonStar className="h-4 w-4" />
          Dark
        </>
      )}
    </Button>
  );
}
