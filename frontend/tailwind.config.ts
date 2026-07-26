import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        background: "rgb(var(--background) / <alpha-value>)",
        foreground: "rgb(var(--foreground) / <alpha-value>)",
        card: "rgb(var(--card) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        primary: "rgb(var(--primary) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        success: "rgb(var(--success) / <alpha-value>)",
        danger: "rgb(var(--danger) / <alpha-value>)"
      },
      boxShadow: {
        glass: "0 24px 60px rgba(15, 23, 42, 0.08)",
      },
      borderRadius: {
        xl: "1.25rem",
        "2xl": "1.75rem",
        "3xl": "2rem",
      },
      fontFamily: {
        sans: ["SF Pro Display", "SF Pro Text", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "hero-glow":
          "radial-gradient(circle at top left, rgba(0,122,255,0.16), transparent 42%), radial-gradient(circle at right center, rgba(82,196,255,0.12), transparent 34%)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
